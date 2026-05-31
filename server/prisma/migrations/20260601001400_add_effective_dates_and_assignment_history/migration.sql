-- Add effectiveFrom/effectiveTo to fee_schedules
ALTER TABLE fee_schedules ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ;
ALTER TABLE fee_schedules ADD COLUMN IF NOT EXISTS effective_to TIMESTAMPTZ;

-- Remove unique constraint on student_fee_assignments to allow history
DROP INDEX IF EXISTS student_fee_assignments_student_id_fee_schedule_id_key;
CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_student_schedule ON student_fee_assignments (student_id, fee_schedule_id);
