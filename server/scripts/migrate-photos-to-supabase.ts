import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = "student-photos";

async function migrateEntity(
  table: "student" | "teacher" | "staff",
  rows: { id: string; photo: Buffer | null }[],
) {
  for (const row of rows) {
    if (!row.photo) continue;
    const ext = "jpg";
    const path = `${table}s/${row.id}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, row.photo, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) {
      console.error(`Failed to upload ${table} ${row.id}: ${error.message}`);
      continue;
    }
    // @ts-ignore - Prisma client may not have photoPath yet in generated types
    await prisma[table].update({ where: { id: row.id }, data: { photoPath: path } });
    console.log(`Migrated ${table} ${row.id}`);
  }
}

async function main() {
  console.log("Migrating existing photos to Supabase Storage...");

  const students = await prisma.student.findMany({ where: { photo: { not: null } }, select: { id: true, photo: true } });
  console.log(`Found ${students.length} students with photos`);
  await migrateEntity("student", students as any);

  const teachers = await prisma.teacher.findMany({ where: { photo: { not: null } }, select: { id: true, photo: true } });
  console.log(`Found ${teachers.length} teachers with photos`);
  await migrateEntity("teacher", teachers as any);

  const staff = await prisma.staff.findMany({ where: { photo: { not: null } }, select: { id: true, photo: true } });
  console.log(`Found ${staff.length} staff with photos`);
  await migrateEntity("staff", staff as any);

  console.log("Migration complete!");
  await prisma.$disconnect();
}

main().catch(console.error);
