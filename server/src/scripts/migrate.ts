import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import * as path from 'path';
import "dotenv/config";

// ══════════════════════════════════════════════════════════
//  Firebase → PostgreSQL Migration Script
//  Usage: npx tsx server/src/scripts/migrate.ts [--dry-run]
// ══════════════════════════════════════════════════════════

const DRY_RUN = process.argv.includes('--dry-run');
const SA_PATH = process.env.FIREBASE_SA_PATH || 'C:/Users/Owner/Downloads/firebasefile.json';
const DB_URL  = "https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app";

// ── Legacy class → Firebase key mapping (matches js/db.js) ──
const LEGACY_KEY_MAP: Record<string, string> = {
  Play: 'play', Nursery: 'nursery', KG: 'kg',
  'Class One': 'one', 'Class Two': 'two', 'Class Three': 'three',
  'Class Four': 'four', 'Class Five': 'five',
};
function classToKey(cls: string) {
  return LEGACY_KEY_MAP[cls] || cls.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ── Firebase key sanitiser (matches js/results.js) ──
function _fk(name: string) {
  return String(name).replace(/[.#$\[\]/]/g, '_');
}

// ── Photo: base64 data URI → Buffer ──
function photoToBuffer(photo: any): Buffer | null {
  if (!photo || typeof photo !== 'string') return null;
  const match = photo.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

// ── Stats ──
const stats = {
  classes: { created: 0, skipped: 0 },
  subjects: { created: 0, skipped: 0, duplicate: 0 },
  students: { created: 0, skipped: 0 },
  results: { created: 0, skipped: 0, terms: 0 },
  teachers: { created: 0, skipped: 0 },
  staff: { created: 0, skipped: 0 },
  books: { created: 0, skipped: 0 },
  attendance: { migrated: 0 },
  comments: { migrated: 0 },
};

function log(emoji: string, msg: string) { console.log(`${emoji}  ${msg}`); }
function warn(msg: string) { console.log(`⚠️  ${msg}`); }

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════

async function migrate() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Firebase → PostgreSQL Migration");
  console.log(DRY_RUN ? "  MODE: DRY RUN (no changes)" : "  MODE: LIVE (writing to DB)");
  console.log("═══════════════════════════════════════════════════\n");

  // ── Init Firebase ──
  let serviceAccount: any;
  try {
    serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf8'));
  } catch {
    console.error(`❌ Cannot read service account key at: ${SA_PATH}`);
    console.error("   Set FIREBASE_SA_PATH env var or place firebasefile.json at that path.");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DB_URL,
  });

  const prisma = new PrismaClient();
  const db = admin.database();
  const snap = await db.ref('school').get();
  const data = snap.val();

  if (!data) {
    console.error("❌ No data found in Firebase at 'school/'");
    await prisma.$disconnect();
    return;
  }

  // ════════════════════════════════════════════════════════
  //  1. CLASSES
  // ════════════════════════════════════════════════════════
  log('📚', 'Migrating classes...');
  const classList: string[] = data.classList || [];
  const classMap = new Map<string, string>(); // className → classId

  for (let i = 0; i < classList.length; i++) {
    const name = classList[i];
    if (!name) continue;

    if (DRY_RUN) {
      stats.classes.created++;
      classMap.set(name, `dry-run-${i}`);
      continue;
    }

    const existing = await prisma.schoolClass.findUnique({ where: { name } });
    if (existing) {
      classMap.set(name, existing.id);
      stats.classes.skipped++;
      continue;
    }

    const cls = await prisma.schoolClass.create({ data: { name, order: i } });
    classMap.set(name, cls.id);
    stats.classes.created++;
  }

  // Map classKey → classId for Firebase path lookups
  const keyToClassId = new Map<string, string>();
  for (const [name, id] of classMap) {
    keyToClassId.set(classToKey(name), id);
    keyToClassId.set(name.toLowerCase().replace(/\s+/g, '_'), id);
  }

  // ════════════════════════════════════════════════════════
  //  2. SUBJECTS (per class, from results config)
  // ════════════════════════════════════════════════════════
  log('📖', 'Migrating subjects...');
  for (const [className, classId] of classMap) {
    const key = classToKey(className);
    const subjectData = data.results?.[key]?.subjects;
    if (!subjectData) continue;

    const subjects = Array.isArray(subjectData) ? subjectData : Object.values(subjectData);
    for (let i = 0; i < subjects.length; i++) {
      const sub = subjects[i] as any;
      if (!sub?.name || !sub?.fullMarks) continue;

      // Check for duplicate names within this batch
      const dup = await prisma.subject.findFirst({ where: { classId, name: sub.name } });
      if (dup) { stats.subjects.duplicate++; continue; }

      if (DRY_RUN) { stats.subjects.created++; continue; }

      await prisma.subject.create({
        data: { name: sub.name, fullMarks: Number(sub.fullMarks), classId, order: i },
      });
      stats.subjects.created++;
    }
  }

  // ════════════════════════════════════════════════════════
  //  3. STUDENTS + RESULTS
  // ════════════════════════════════════════════════════════
  log('🎓', 'Migrating students & results...');

  // Build a map of firebase sid → student (for result linking)
  const firebaseSidToStudentId = new Map<string, { studentId: string, className: string, classKey: string }>();

  if (data.students) {
    for (const [classKey, studentsObj] of Object.entries(data.students)) {
      const students = Array.isArray(studentsObj) ? studentsObj : Object.values(studentsObj as any);

      for (const s of students as any[]) {
        if (!s?.name) { warn(`Skipping student with no name in classKey=${classKey}`); continue; }

        const photoBuffer = photoToBuffer(s.photo);
        // Field name mapping: Firebase uses contactNumber, Prisma uses contact
        const contact = s.contact || s.contactNumber || null;

        // Build firebase sid mapping for result linking (always, even in dry-run)
        const sid = (s.roll ? 'r' + s.roll : 'n' + s.name.replace(/\s+/g, '_')).toLowerCase();
        firebaseSidToStudentId.set(sid, { studentId: `dry-student-${stats.students.created}`, className: s.class, classKey });
        stats.students.created++;

        if (DRY_RUN) continue;

        // Check for duplicate student (by name + class)
        const existing = await prisma.student.findFirst({
          where: { name: s.name, class: s.class },
        });
        if (existing) {
          stats.students.skipped++;
          firebaseSidToStudentId.set(sid, { studentId: existing.id, className: s.class, classKey });
          continue;
        }

        const student = await prisma.student.create({
          data: {
            name: s.name,
            class: s.class,
            roll: s.roll ? String(s.roll) : null,
            fatherName: s.fatherName || null,
            motherName: s.motherName || null,
            contact,
            photo: photoBuffer,
          },
        });

        firebaseSidToStudentId.set(sid, { studentId: student.id, className: s.class, classKey });
      }
    }
  }

  // ── Results ──
  log('📝', 'Migrating results...');
  if (data.results) {
    for (const [classKey, classResultData] of Object.entries(data.results)) {
      const classId = keyToClassId.get(classKey);
      const studentsObj = (classResultData as any)?.results;
      if (!studentsObj) continue;

      for (const [firebaseSid, studentResult] of Object.entries(studentsObj)) {
        const mapping = firebaseSidToStudentId.get(firebaseSid);
        if (!mapping) { warn(`No student mapping for firebase sid="${firebaseSid}" in classKey="${classKey}"`); continue; }

        const result = studentResult as any;
        if (!result?.terms) continue;

        const comment = result.comment || null;

        for (const [term, marks] of Object.entries(result.terms)) {
          if (!marks || (typeof marks === 'object' && Object.keys(marks).length === 0)) continue;

          // Clean marks: remove null/undefined entries
          let cleanMarks: Record<string, number> = {};
          if (typeof marks === 'object' && !Array.isArray(marks)) {
            for (const [k, v] of Object.entries(marks)) {
              if (v !== null && v !== undefined && v !== '') {
                cleanMarks[k] = Number(v);
              }
            }
          }
          if (Object.keys(cleanMarks).length === 0) continue;

          // Get attendance for this term
          let attendance: { days: number; present: number } | null = null;
          if (result.attendance) {
            const termAtt = result.attendance[term];
            if (termAtt && typeof termAtt === 'object' && 'days' in termAtt) {
              attendance = { days: Number(termAtt.days) || 0, present: Number(termAtt.present) || 0 };
              stats.attendance.migrated++;
            }
          }

          if (DRY_RUN) { stats.results.terms++; continue; }

          // Upsert: one Result row per student per term
          const existing = await prisma.result.findFirst({
            where: { studentId: mapping.studentId, term: String(term) },
          });

          if (existing) {
            await prisma.result.update({
              where: { id: existing.id },
              data: { marks: cleanMarks, attendance, comment },
            });
          } else {
            await prisma.result.create({
              data: {
                studentId: mapping.studentId,
                term: String(term),
                marks: cleanMarks,
                attendance,
                comment,
              },
            });
          }
          stats.results.terms++;
        }

        if (comment) stats.comments.migrated++;
      }
    }
  }

  // ════════════════════════════════════════════════════════
  //  4. TEACHERS
  // ════════════════════════════════════════════════════════
  log('👩‍🏫', 'Migrating teachers...');
  if (data.teachers) {
    const teachers = Array.isArray(data.teachers) ? data.teachers : Object.values(data.teachers);
    for (const t of teachers as any[]) {
      if (!t?.name) continue;
      const photoBuffer = photoToBuffer(t.photo);
      const contact = t.contact || t.contactNumber || null;

      if (DRY_RUN) { stats.teachers.created++; continue; }

      const existing = await prisma.teacher.findFirst({ where: { name: t.name } });
      if (existing) { stats.teachers.skipped++; continue; }

      await prisma.teacher.create({
        data: {
          name: t.name,
          designation: t.designation || '',
          email: t.email || null,
          contact,
          photo: photoBuffer,
        },
      });
      stats.teachers.created++;
    }
  }

  // ════════════════════════════════════════════════════════
  //  5. STAFF
  // ════════════════════════════════════════════════════════
  log('👷', 'Migrating staff...');
  if (data.staff) {
    const staffList = Array.isArray(data.staff) ? data.staff : Object.values(data.staff);
    for (const s of staffList as any[]) {
      if (!s?.name) continue;
      const photoBuffer = photoToBuffer(s.photo);
      const contact = s.contact || s.contactNumber || null;

      if (DRY_RUN) { stats.staff.created++; continue; }

      const existing = await prisma.staff.findFirst({ where: { name: s.name } });
      if (existing) { stats.staff.skipped++; continue; }

      await prisma.staff.create({
        data: {
          name: s.name,
          role: s.role || '',
          email: s.email || null,
          contact,
          photo: photoBuffer,
        },
      });
      stats.staff.created++;
    }
  }

  // ════════════════════════════════════════════════════════
  //  6. BOOKS
  // ════════════════════════════════════════════════════════
  log('📦', 'Migrating books...');
  if (data.books) {
    for (const [classKey, bookData] of Object.entries(data.books)) {
      const classId = keyToClassId.get(classKey);
      if (!classId || classId.startsWith('dry-run')) continue;

      const books = Array.isArray(bookData) ? bookData : Object.values(bookData as any);
      for (const b of books as any[]) {
        if (!b?.name) continue;

        if (DRY_RUN) { stats.books.created++; continue; }

        const existing = await prisma.book.findFirst({ where: { name: b.name, classId } });
        if (existing) { stats.books.skipped++; continue; }

        // Field name mapping: Firebase uses discountedPrice/sellPrice, Prisma uses discounted/sell
        const mrp = Number(b.mrp) || 0;
        const discounted = Number(b.discounted ?? b.discountedPrice) || 0;
        const sell = Number(b.sell ?? b.sellPrice) || 0;

        await prisma.book.create({
          data: {
            name: b.name,
            publication: b.publication || null,
            mrp,
            discounted,
            sell,
            classId,
          },
        });
        stats.books.created++;
      }
    }
  }

  // ════════════════════════════════════════════════════════
  //  SUMMARY
  // ════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Migration Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Classes:    ${stats.classes.created} created, ${stats.classes.skipped} skipped`);
  console.log(`  Subjects:   ${stats.subjects.created} created, ${stats.subjects.skipped} skipped`);
  console.log(`  Students:   ${stats.students.created} created, ${stats.students.skipped} skipped`);
  console.log(`  Results:    ${stats.results.terms} term-rows created`);
  console.log(`  Attendance: ${stats.attendance.migrated} entries migrated`);
  console.log(`  Comments:   ${stats.comments.migrated} migrated`);
  console.log(`  Teachers:   ${stats.teachers.created} created, ${stats.teachers.skipped} skipped`);
  console.log(`  Staff:      ${stats.staff.created} created, ${stats.staff.skipped} skipped`);
  console.log(`  Books:      ${stats.books.created} created, ${stats.books.skipped} skipped`);
  console.log("═══════════════════════════════════════════════════");

  if (DRY_RUN) {
    console.log("\n  ⚠️  DRY RUN — no data was written. Remove --dry-run to execute.");
  }

  await prisma.$disconnect();
}

migrate()
  .catch(e => { console.error("❌ Migration failed:", e); process.exit(1); });
