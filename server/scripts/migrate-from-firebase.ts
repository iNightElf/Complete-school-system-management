// Migration script: Firebase (old app) → PostgreSQL (new app)
import { PrismaClient } from "@prisma/client";

const FIREBASE_URL = "https://student-info-41f18-default-rtdb.asia-southeast1.firebasedatabase.app/school.json";
const prisma = new PrismaClient();

async function migrate() {
  console.log("Fetching data from Firebase...");
  const res = await fetch(FIREBASE_URL);
  const data = await res.json();
  if (!data) { console.log("No data found"); return; }

  const classes = data.classList || [];
  console.log(`Found ${classes.length} classes, ${(data.students ? Object.values(data.students).flat().length : 0)} students, ${data.teachers?.length || 0} teachers, ${data.staff?.length || 0} staff`);

  // 1. Create classes
  console.log("\n--- Creating Classes ---");
  for (let i = 0; i < classes.length; i++) {
    const name = classes[i];
    await prisma.schoolClass.upsert({
      where: { name },
      update: { order: i },
      create: { name, order: i },
    });
    console.log(`  ${name}`);
  }

  // 2. Create students
  console.log("\n--- Creating Students ---");
  let studentCount = 0;
  if (data.students) {
    for (const [classKey, studentList] of Object.entries(data.students)) {
      const arr = Array.isArray(studentList) ? studentList : Object.values(studentList);
      for (const s of arr) {
        if (!s || !s.name) continue;
        const photoBuffer = s.photo && typeof s.photo === 'string' && s.photo.includes('base64,')
          ? Buffer.from(s.photo.split(',')[1], 'base64')
          : null;
        try {
          // Skip if student with same name+class already exists
          const existing = await prisma.student.findFirst({ where: { name: s.name, class: s.class || classKey } });
          if (existing) continue;
          await prisma.student.create({
            data: {
              class: s.class || classKey,
              roll: s.roll || null,
              name: s.name,
              fatherName: s.fatherName || null,
              motherName: s.motherName || null,
              contact: s.contactNumber || null,
              photo: photoBuffer,
            },
          });
          studentCount++;
        } catch (e: any) {
          console.error(`  Failed to create student ${s.name}: ${e.message}`);
        }
      }
    }
  }
  console.log(`  Created ${studentCount} students`);

  // 3. Create teachers
  console.log("\n--- Creating Teachers ---");
  let teacherCount = 0;
  if (data.teachers) {
    const arr = Array.isArray(data.teachers) ? data.teachers : Object.values(data.teachers);
    for (const t of arr) {
      if (!t || !t.name) continue;
      const photoBuffer = t.photo && typeof t.photo === 'string' && t.photo.includes('base64,')
        ? Buffer.from(t.photo.split(',')[1], 'base64')
        : null;
      const existingTeacher = await prisma.teacher.findFirst({ where: { name: t.name } });
      if (existingTeacher) continue;
      try {
        await prisma.teacher.create({
          data: {
            designation: t.designation || 'Teacher',
            name: t.name,
            email: t.email || null,
            contact: t.contactNumber || null,
            photo: photoBuffer,
          },
        });
        teacherCount++;
      } catch (e: any) {
        console.error(`  Failed to create teacher ${t.name}: ${e.message}`);
      }
    }
  }
  console.log(`  Created ${teacherCount} teachers`);

  // 4. Create staff
  console.log("\n--- Creating Staff ---");
  let staffCount = 0;
  if (data.staff) {
    const arr = Array.isArray(data.staff) ? data.staff : Object.values(data.staff);
    for (const s of arr) {
      if (!s || !s.name) continue;
      const photoBuffer = s.photo && typeof s.photo === 'string' && s.photo.includes('base64,')
        ? Buffer.from(s.photo.split(',')[1], 'base64')
        : null;
      const existingStaff = await prisma.staff.findFirst({ where: { name: s.name } });
      if (existingStaff) continue;
      try {
        await prisma.staff.create({
          data: {
            role: s.role || 'Staff',
            name: s.name,
            email: s.email || null,
            contact: s.contactNumber || null,
            photo: photoBuffer,
          },
        });
        staffCount++;
      } catch (e: any) {
        console.error(`  Failed to create staff ${s.name}: ${e.message}`);
      }
    }
  }
  console.log(`  Created ${staffCount} staff`);

  // 5. Create books
  console.log("\n--- Creating Books ---");
  let bookCount = 0;
  if (data.books) {
    for (const [classKey, bookList] of Object.entries(data.books)) {
      const arr = Array.isArray(bookList) ? bookList : Object.values(bookList);
      for (const b of arr) {
        if (!b || !b.name) continue;
        // Find the class name from the classKey
        // Reverse map from Firebase classKey to class name
        const KEY_TO_CLASS: Record<string, string> = Object.fromEntries(
          classes.map((c: string) => {
            const key = ({ Play:'play', Nursery:'nursery', KG:'kg', 'Class One':'one', 'Class Two':'two', 'Class Three':'three', 'Class Four':'four', 'Class Five':'five' } as Record<string, string>)[c]
              || c.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
            return [key, c];
          })
        );
        const className = KEY_TO_CLASS[classKey] || classes.find((c: string) =>
          c.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') === classKey
        ) || classKey;
        const cls = await prisma.schoolClass.findUnique({ where: { name: className } });
        if (!cls) { console.error(`  Class ${className} not found for book ${b.name}`); continue; }
        const existingBook = await prisma.book.findFirst({ where: { name: b.name, classId: cls.id } });
        if (existingBook) continue;
        try {
          await prisma.book.create({
            data: {
              name: b.name,
              publication: b.publication || null,
              mrp: Number(b.mrp) || 0,
              discounted: Number(b.discounted) || 0,
              sell: Number(b.sell) || 0,
              classId: cls.id,
            },
          });
          bookCount++;
        } catch (e: any) {
          console.error(`  Failed to create book ${b.name}: ${e.message}`);
        }
      }
    }
  }
  console.log(`  Created ${bookCount} books`);

  // 6. Create subjects and results
  console.log("\n--- Creating Subjects & Results ---");
  if (data.results) {
    for (const [classKey, classResults] of Object.entries(data.results)) {
      const r = classResults as any;
      if (!r.subjects || !r.results) continue;

      const KEY_TO_CLASS2: Record<string, string> = Object.fromEntries(
        classes.map((c: string) => {
          const key = ({ Play:'play', Nursery:'nursery', KG:'kg', 'Class One':'one', 'Class Two':'two', 'Class Three':'three', 'Class Four':'four', 'Class Five':'five' } as Record<string, string>)[c]
            || c.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
          return [key, c];
        })
      );
      const className = KEY_TO_CLASS2[classKey] || classes.find((c: string) =>
        c.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') === classKey
      ) || classKey;

      const cls = await prisma.schoolClass.findUnique({ where: { name: className } });
      if (!cls) { console.error(`  Class ${className} not found for results`); continue; }

      // Create subjects
      const subjs = Array.isArray(r.subjects) ? r.subjects : Object.values(r.subjects);
      for (let i = 0; i < subjs.length; i++) {
        const subj = subjs[i];
        if (!subj || !subj.name) continue;
        try {
          await prisma.subject.upsert({
            where: { name_classId: { name: subj.name, classId: cls.id } },
            update: { fullMarks: Number(subj.fullMarks) || 100, order: i },
            create: { name: subj.name, fullMarks: Number(subj.fullMarks) || 100, classId: cls.id, order: i },
          });
        } catch (e: any) {
          console.error(`  Failed to create subject ${subj.name}: ${e.message}`);
        }
      }

      // Create results
      const resultsObj = r.results as Record<string, any>;
      for (const [studentKey, studentRes] of Object.entries(resultsObj)) {
        const sr = studentRes as any;
        if (!sr || !sr.terms) continue;

        // Find student by name+class matching
        const students = await prisma.student.findMany({ where: { class: className } });
        let matchedStudent = null;
        for (const st of students) {
          // Old app generates ID from roll or name
          const oldId = (st.roll ? 'r' + st.roll : 'n' + st.name.replace(/\s+/g, '_')).toLowerCase();
          if (oldId === studentKey) { matchedStudent = st; break; }
        }
        if (!matchedStudent) {
          // Try exact name match
          matchedStudent = students.find(st => {
            const oldId = 'n' + st.name.replace(/\s+/g, '_').toLowerCase();
            return oldId === studentKey;
          });
        }
        if (!matchedStudent) { console.error(`  Student not found for key ${studentKey} in ${className}`); continue; }

        // Create results for each term
        for (const [termKey, marks] of Object.entries(sr.terms)) {
          const termMarks = marks as Record<string, number>;
          if (!termMarks || Object.keys(termMarks).length === 0) continue;
          try {
            await prisma.result.upsert({
              where: { studentId_term: { studentId: matchedStudent.id, term: termKey } },
              update: { marks: termMarks, attendance: sr.attendance || null },
              create: {
                studentId: matchedStudent.id,
                term: termKey,
                marks: termMarks,
                attendance: sr.attendance || null,
              },
            });
          } catch (e: any) {
            console.error(`  Failed to save result for ${matchedStudent.name} term ${termKey}: ${e.message}`);
          }
        }
      }
    }
  }
  console.log("  Subjects & results created");

  console.log("\n=== Migration Complete ===");
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
