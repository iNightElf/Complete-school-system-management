-- Add student_id and session columns
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "student_id" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "session" TEXT DEFAULT '2026';

-- Migrate existing roll data to student_id
UPDATE "Student" SET "student_id" = "roll" WHERE "student_id" IS NULL AND "roll" IS NOT NULL;

-- Generate student_id for any rows with null roll using a DO block
DO '
DECLARE
    counter INT := 1;
    rec RECORD;
BEGIN
    FOR rec IN SELECT id FROM "Student" WHERE "student_id" IS NULL ORDER BY "createdAt"
    LOOP
        UPDATE "Student" SET "student_id" = LPAD(counter::TEXT, 6, ''0'') WHERE id = rec.id;
        counter := counter + 1;
    END LOOP;
END;
';

-- Make student_id NOT NULL after data migration
ALTER TABLE "Student" ALTER COLUMN "student_id" SET NOT NULL;

-- Create unique index on student_id
CREATE UNIQUE INDEX IF NOT EXISTS "Student_student_id_key" ON "Student"("student_id");

-- Create index on session
CREATE INDEX IF NOT EXISTS "Student_session_idx" ON "Student"("session");

-- Drop the old class+roll unique constraint (Prisma names it Student_class_roll_key)
DROP INDEX IF EXISTS "Student_class_roll_key";

-- Set session for existing students
UPDATE "Student" SET "session" = '2026' WHERE "session" IS NULL;
