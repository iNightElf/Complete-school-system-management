import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.teacher.deleteMany({});
  await prisma.staff.deleteMany({});
  console.log("Deleted all teachers and staff");
  await prisma.$disconnect();
}
main().catch(console.error);
