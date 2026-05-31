import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.result.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.book.deleteMany({});
  console.log("Cleared books, subjects, results");
  await prisma.$disconnect();
}
main().catch(console.error);
