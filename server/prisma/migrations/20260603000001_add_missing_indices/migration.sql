-- AddMissingIndices
-- Add indices to commonly-filtered columns across 6 models

CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user"("role");

CREATE INDEX IF NOT EXISTS "Teacher_name_idx" ON "Teacher"("name");
CREATE INDEX IF NOT EXISTS "Teacher_designation_idx" ON "Teacher"("designation");

CREATE INDEX IF NOT EXISTS "Staff_name_idx" ON "Staff"("name");
CREATE INDEX IF NOT EXISTS "Staff_role_idx" ON "Staff"("role");

CREATE INDEX IF NOT EXISTS "Result_session_idx" ON "Result"("session");

CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");

CREATE INDEX IF NOT EXISTS "transactions_fiscal_year_idx" ON "transactions"("fiscal_year");
