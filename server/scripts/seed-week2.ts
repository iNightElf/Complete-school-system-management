import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Week 2 data...");

  // 1. Backfill classId for existing students
  const students = await prisma.student.findMany({ where: { classId: null } });
  const classes = await prisma.schoolClass.findMany();
  const classMap = Object.fromEntries(classes.map(c => [c.name, c.id]));
  let updated = 0;
  for (const s of students) {
    if (classMap[s.class]) {
      await prisma.student.update({ where: { id: s.id }, data: { classId: classMap[s.class] } });
      updated++;
    }
  }
  console.log(`Backfilled classId for ${updated} students`);

  // 2. Create AcademicYear (2025-2026)
  const existingYear = await prisma.academicYear.findUnique({ where: { name: "2025-2026" } });
  if (!existingYear) {
    await prisma.academicYear.create({
      data: {
        name: "2025-2026",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-08-31"),
        isActive: true,
      },
    });
    console.log("Created AcademicYear: 2025-2026");
  } else {
    console.log("AcademicYear 2025-2026 already exists");
  }

  // 3. Populate Category table
  const incomeCategories = [
    "Tuition Fee", "Hifz Tuition Fee", "Admission Fee", "Hifz Admission Fee",
    "Books Fee", "Copy Fee", "Stationary Fee", "Accessories Fee", "Transport Fee",
    "Late Fee", "Library Fee", "Sports Fee", "Exam Fee", "Other Income",
  ];
  const expenseCategories = [
    "Salary", "Rent", "Electricity", "Water", "Internet", "Maintenance",
    "Transport", "Stationary", "Food", "Medical", "Advertising",
    "Security", "Insurance", "Miscellaneous", "Other Expense",
  ];

  for (const name of incomeCategories) {
    await prisma.category.upsert({ where: { type_name: { type: "INCOME", name } }, update: {}, create: { type: "INCOME", name } });
  }
  for (const name of expenseCategories) {
    await prisma.category.upsert({ where: { type_name: { type: "EXPENSE", name } }, update: {}, create: { type: "EXPENSE", name } });
  }
  console.log(`Seeded ${incomeCategories.length} income + ${expenseCategories.length} expense categories`);

  await prisma.$disconnect();
  console.log("Done");
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
