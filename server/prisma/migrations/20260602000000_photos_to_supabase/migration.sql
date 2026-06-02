-- Replace photo (Bytes) columns with photoPath (String) for storage paths in Supabase
ALTER TABLE "Student" ADD COLUMN "photo_path" TEXT;
ALTER TABLE "Teacher" ADD COLUMN "photo_path" TEXT;
ALTER TABLE "Staff" ADD COLUMN "photo_path" TEXT;
