-- CreateTable
CREATE TABLE IF NOT EXISTS "period_closes" (
    "id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" VARCHAR(100),
    "notes" TEXT,
    CONSTRAINT "period_closes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "period_closes_fiscal_year_key" ON "period_closes"("fiscal_year");

CREATE TABLE IF NOT EXISTS "reconciliations" (
    "id" TEXT NOT NULL,
    "account" VARCHAR(100) NOT NULL,
    "statement_date" TIMESTAMP(3) NOT NULL,
    "closing_balance" DECIMAL(12,2) NOT NULL,
    "system_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(100),
    CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reconciliations_account_idx" ON "reconciliations"("account");
CREATE INDEX IF NOT EXISTS "reconciliations_created_at_idx" ON "reconciliations"("created_at");
