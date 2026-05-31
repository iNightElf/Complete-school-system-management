import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  console.log("Students:", await prisma.student.count());
  console.log("Teachers:", await prisma.teacher.count());
  console.log("Staff:", await prisma.staff.count());
  console.log("Books:", await prisma.book.count());
  console.log("Subjects:", await prisma.subject.count());
  console.log("Results:", await prisma.result.count());
  const byClass = await prisma.student.groupBy({ by: ["class"], _count: true });
  for (const c of byClass.sort((a, b) => a.class.localeCompare(b.class))) {
    console.log(`  ${c.class}: ${c._count}`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
