import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Migrating old fee_assignments → student_fee_assignments...");

  // Read old data via raw query (model was removed from schema)
  const oldAssignments: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM fee_assignments WHERE active = true`
  );
  console.log(`Found ${oldAssignments.length} active old assignments`);

  const feeSchedules = await prisma.feeSchedule.findMany({ where: { applicability: "ASSIGNED_ONLY" } });

  const typeToCategory: Record<string, string> = {
    hifz_tuition: "Hifz Tuition Fee",
    hifz_admission: "Hifz Admission Fee",
    transport: "Transport Fee",
  };

  let created = 0;
  let skipped = 0;

  for (const old of oldAssignments) {
    const category = typeToCategory[old.fee_type];
    if (!category) { skipped++; continue; }

    const students: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, class_id FROM students WHERE id = $1`, old.student_id
    );
    if (!students.length) { skipped++; continue; }
    const student = students[0];

    const schedule = feeSchedules.find(fs =>
      fs.category === category &&
      (fs.classId === null || fs.classId === student.class_id)
    );
    if (!schedule) { skipped++; continue; }

    await prisma.$executeRawUnsafe(
      `INSERT INTO student_fee_assignments (id, student_id, fee_schedule_id, active)
       VALUES (gen_random_uuid(), $1, $2, true)
       ON CONFLICT (student_id, fee_schedule_id) DO UPDATE SET active = true`,
      old.student_id, schedule.id
    );
    created++;
  }

  console.log(`Created ${created} new assignments, skipped ${skipped}`);
  console.log("Done");
}

main()
  .catch(e => { console.error("Migration failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
