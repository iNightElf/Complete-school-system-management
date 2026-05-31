import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

let rawData = readFileSync('C:\\Users\\Owner\\AppData\\Local\\Temp\\firebase_data.json', 'utf-8');
if (rawData.charCodeAt(0) === 0xFEFF) rawData = rawData.slice(1);
const FB = JSON.parse(rawData);

const p = new PrismaClient();

const LEGACY_KEYS = { Play:'play', Nursery:'nursery', KG:'kg', 'Class One':'one', 'Class Two':'two', 'Class Three':'three', 'Class Four':'four', 'Class Five':'five' };
function classKeyToName(key) {
  return Object.entries(LEGACY_KEYS).find(([,v]) => v === key)?.[0] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

async function main() {
  console.log('=== Migration from Firebase to PostgreSQL ===\n');

  // 1. Academic Year
  let ay = await p.academicYear.findFirst({ where: { name: '2026' } });
  if (!ay) {
    ay = await p.academicYear.create({ data: { name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isActive: true } });
    console.log('Created academic year: 2026');
  } else {
    console.log('Academic year 2026 exists');
  }

  // 2. Classes
  const classList = FB.classList || [];
  const classes = {};
  for (let i = 0; i < classList.length; i++) {
    const name = classList[i];
    let cl = await p.schoolClass.findUnique({ where: { name } });
    if (!cl) cl = await p.schoolClass.create({ data: { name, order: i } });
    const key = LEGACY_KEYS[name] || name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    classes[key] = cl;
  }
  console.log(`Classes: ${Object.keys(classes).length}`);

  // 3. Students
  let sCount = 0;
  for (const [ck, arr] of Object.entries(FB.students || {})) {
    const cls = classes[ck];
    if (!cls) continue;
    for (const s of (arr || [])) {
      if (!s?.name) continue;
      const roll = s.roll || s.id || null;
      if (roll) {
        const exists = await p.student.findFirst({ where: { class: cls.name, roll } });
        if (exists) continue;
      }
      await p.student.create({
        data: {
          class: cls.name,
          classId: cls.id,
          roll,
          name: s.name,
          fatherName: s.fatherName || s.father || null,
          motherName: s.motherName || s.mother || null,
          contact: s.contact || s.phone || s.contactNumber || null,
        }
      });
      sCount++;
    }
  }
  console.log(`Students: ${sCount}`);

  // 4. Teachers
  let tCount = 0;
  for (const t of (FB.teachers || [])) {
    if (!t?.name) continue;
    const exists = await p.teacher.findFirst({ where: { name: t.name } });
    if (exists) continue;
    await p.teacher.create({ data: { designation: t.designation || t.role || 'Teacher', name: t.name, email: t.email || null, contact: t.contact || t.phone || null } });
    tCount++;
  }
  console.log(`Teachers: ${tCount}`);

  // 5. Staff
  let stCount = 0;
  for (const s of (FB.staff || [])) {
    if (!s?.name) continue;
    const exists = await p.staff.findFirst({ where: { name: s.name } });
    if (exists) continue;
    await p.staff.create({ data: { role: s.role || s.designation || 'Staff', name: s.name, email: s.email || null, contact: s.contact || s.phone || null } });
    stCount++;
  }
  console.log(`Staff: ${stCount}`);

  // 6. Books
  let bCount = 0;
  for (const [ck, arr] of Object.entries(FB.books || {})) {
    const cls = classes[ck];
    if (!cls) continue;
    for (const bk of (arr || [])) {
      if (!bk?.name) continue;
      const exists = await p.book.findFirst({ where: { name: bk.name, classId: cls.id } });
      if (exists) continue;
      await p.book.create({ data: { name: bk.name, publication: bk.publication || null, mrp: bk.mrp || 0, discounted: bk.discountedPrice || bk.discounted || 0, sell: bk.sellPrice || bk.sell || 0, classId: cls.id } });
      bCount++;
    }
  }
  console.log(`Books: ${bCount}`);

  // 7. Fee Schedules (clean up duplicates first)
  const allFees = await p.feeSchedule.findMany({ select: { id: true, category: true, classId: true, academicYearId: true, frequency: true } });
  const seen = new Set();
  for (const f of allFees) {
    const key = `${f.academicYearId}|${f.classId}|${f.category}|${f.frequency}`;
    if (seen.has(key)) {
      await p.feeSchedule.delete({ where: { id: f.id } });
      console.log(`  Removed duplicate fee: ${f.category}`);
    } else {
      seen.add(key);
    }
  }

  const heads = FB.fees?.heads || [];
  const classFees = FB.fees?.classFees || {};
  const headMap = {};
  for (const h of heads) {
    headMap[h.name.toLowerCase().replace(/\s+/g,'')] = h;
  }

  let fCount = 0;
  for (const [ck, items] of Object.entries(classFees)) {
    const cls = classes[ck];
    if (!cls) continue;
    for (const [feeKey, amount] of Object.entries(items)) {
      const head = headMap[feeKey];
      const name = head?.name || feeKey;
      const frequency = head?.frequency === 'monthly' ? 'MONTHLY' : 'YEARLY';
      try {
        await p.feeSchedule.create({
          data: {
            academicYearId: ay.id, classId: cls.id, category: name,
            amount, frequency, applicability: 'AUTO',
          }
        });
        fCount++;
      } catch (e) {
        if (e.code !== 'P2002') console.log(`  Fee error: ${e.message}`);
      }
    }
  }
  console.log(`Fee schedules: ${fCount}`);

  // 8. Results (use raw SQL since Prisma client may be out of sync)
  let rCount = 0;
  for (const [ck, cr] of Object.entries(FB.results || {})) {
    const cls = classes[ck];
    if (!cls) continue;
    const results = cr?.results || {};
    for (const [sidOrName, data] of Object.entries(results)) {
      if (!data?.terms) continue;
      // Find student by roll (strip 'r' prefix) or name
      const rollMatch = sidOrName.replace(/^r(\d+)$/, '$1');
      let student;
      if (rollMatch !== sidOrName) {
        student = await p.student.findFirst({ where: { class: cls.name, roll: rollMatch } });
      }
      if (!student) {
        // Try by name (Firebase uses underscores)
        const name = sidOrName.replace(/_/g, ' ');
        student = await p.student.findFirst({ where: { class: cls.name, name: { contains: name } } });
      }
      if (!student) {
        // Fuzzy name match: strip leading single chars, replace underscores with spaces
        const searchName = sidOrName.replace(/^[a-z0-9](?=[a-z])/i, '').replace(/_/g, ' ').trim();
        const allStudents = await p.student.findMany({ where: { class: cls.name }, select: { id: true, name: true } });
        const match = allStudents.find(s =>
          s.name.replace(/\s+/g,'').toLowerCase() === searchName.replace(/\s+/g,'').toLowerCase() ||
          sidOrName.replace(/_/g, '').toLowerCase().includes(s.name.replace(/\s+/g,'').toLowerCase()) ||
          s.name.replace(/\s+/g,'').toLowerCase().includes(sidOrName.replace(/_/g, '').toLowerCase())
        );
        if (match) student = { id: match.id };
      }
      if (!student) {
        console.log(`  Result: student ${sidOrName} not found in ${cls.name}`);
        continue;
      }

      const terms = data.terms;
      const attendance = data.attendance || null;
      const comment = data.comment || null;

      for (let t = 0; t < terms.length; t++) {
        const td = terms[t];
        if (!td) continue;
        const term = `Term ${t + 1}`;
        try {
          const params = [student.id, term, JSON.stringify(td), attendance?.[t] ? JSON.stringify(attendance[t]) : null, comment];
          await p.$executeRawUnsafe(
            `INSERT INTO "Result" ("id", "studentId", "session", "term", "marks", "attendance", "comment", "createdAt")
             VALUES (gen_random_uuid()::text, $1, '2026', $2, $3::jsonb, $4::jsonb, $5, NOW())`,
            ...params
          );
          rCount++;
        } catch (e) {
          if (e.message?.includes('unique') || e.code === '23505') {
            console.log(`  Result ${student.name || sidOrName} ${term} exists, skip`);
          } else {
            console.log(`  Result error: ${e.message}`);
          }
        }
      }
    }
  }
  console.log(`Results: ${rCount}`);

  // 9. Transactions (fee payments)
  const payments = FB.fees?.payments || {};
  const studentFees = FB.fees?.studentFees || {};
  let txCount = 0;

  for (const [ck, sf] of Object.entries(studentFees)) {
    const cls = classes[ck];
    if (!cls) continue;
    for (const [sid, feeData] of Object.entries(sf)) {
      const roll = sid.replace(/^r(\d+)$/, '$1');
      const student = await p.student.findFirst({ where: { class: cls.name, roll } });
      if (!student) continue;

      const txPayments = payments[sid];
      if (!txPayments) continue;

      for (const [feeHeadId, periods] of Object.entries(txPayments)) {
        const head = heads.find(h => h.id === feeHeadId);
        if (!head) continue;
        for (const [period, pd] of Object.entries(periods || {})) {
          if (!pd?.amount) continue;
          const refId = `${sid}_${feeHeadId}_${period}`;
          try {
            await p.transaction.create({
              data: {
                transactionDate: new Date(pd.date || Date.now()),
                transactionType: 'income',
                amount: pd.amount,
                category: head.name,
                description: `${cls.name} - ${head.name} - ${period}`,
                studentId: student.id,
                className: cls.name,
                affectsIncomeLedger: true,
                affectsExpenseLedger: false,
                feeMonth: period,
                referenceId: refId,
              }
            });
            txCount++;
          } catch (e) {
            if (e.code !== 'P2002') console.log(`  Tx error: ${e.message}`);
          }
        }
      }
    }
  }
  console.log(`Transactions: ${txCount}`);

  console.log('\n=== Migration complete! ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => p.$disconnect());
