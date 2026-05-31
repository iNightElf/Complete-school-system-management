import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const books = await prisma.book.findMany({ include: { class: true } });
  for (const b of books) {
    console.log(`id=${b.id} name=${b.name} class=${b.class?.name || b.classId}`);
  }
  // Delete all books to re-run cleanly
  await prisma.book.deleteMany({});
  console.log("Deleted all books");
  await prisma.$disconnect();
}
main().catch(console.error);
