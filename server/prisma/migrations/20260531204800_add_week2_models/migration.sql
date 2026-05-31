-- Drop old fee_assignments table (replaced by fee_schedules + student_fee_assignments)
DROP TABLE IF EXISTS "fee_assignments";

-- Add class_id FK column to Student
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "class_id" TEXT;
CREATE INDEX IF NOT EXISTS "Student_class_id_idx" ON "Student"("class_id");
ALTER TABLE "Student" ADD CONSTRAINT "Student_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "academic_years" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fee_schedules" (
    "id" UUID NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "class_id" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    "applicability" VARCHAR(20) NOT NULL DEFAULT 'AUTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_allocations" (
    "id" TEXT NOT NULL,
    "transaction_id" UUID NOT NULL,
    "fee_schedule_id" UUID,
    "student_id" TEXT NOT NULL,
    "period" VARCHAR(20),
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" VARCHAR(100),
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(100),
    "details" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fee_waivers" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_schedule_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "approvedBy" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "student_fee_assignments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_schedule_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_fee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_name_key" ON "academic_years"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fee_schedules_academic_year_id_class_id_category_idx" ON "fee_schedules"("academic_year_id", "class_id", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_allocations_transaction_id_idx" ON "payment_allocations"("transaction_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_allocations_fee_schedule_id_idx" ON "payment_allocations"("fee_schedule_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_allocations_student_id_period_idx" ON "payment_allocations"("student_id", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "categories_type_name_key" ON "categories"("type", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fee_waivers_student_id_idx" ON "fee_waivers"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fee_waivers_fee_schedule_id_idx" ON "fee_waivers"("fee_schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fee_waivers_student_id_fee_schedule_id_key" ON "fee_waivers"("student_id", "fee_schedule_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_fee_assignments_student_id_idx" ON "student_fee_assignments"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_fee_assignments_fee_schedule_id_idx" ON "student_fee_assignments"("fee_schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "student_fee_assignments_student_id_fee_schedule_id_key" ON "student_fee_assignments"("student_id", "fee_schedule_id");

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_waivers" ADD CONSTRAINT "fee_waivers_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fee_assignments" ADD CONSTRAINT "student_fee_assignments_fee_schedule_id_fkey" FOREIGN KEY ("fee_schedule_id") REFERENCES "fee_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
