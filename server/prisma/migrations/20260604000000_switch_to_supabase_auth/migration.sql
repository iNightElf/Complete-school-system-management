-- Drop Better-Auth tables (no longer needed with Supabase Auth)
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;

-- Update user table: remove constraints referencing dropped tables
-- (relations were already removed from Prisma schema)