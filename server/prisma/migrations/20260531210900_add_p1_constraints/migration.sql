-- DropIndex
DROP INDEX IF EXISTS "Result_studentId_term_key";

-- AlterTable
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "session" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Result_studentId_term_session_key" ON "Result"("studentId", "term", "session");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Student_class_roll_key" ON "Student"("class", "roll");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fee_schedules_academic_year_id_class_id_category_frequency_key" ON "fee_schedules"("academic_year_id", "class_id", "category", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_reference_id_key" ON "transactions"("reference_id");
