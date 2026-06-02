-- Create receipt counter table and add receipt sequence to transactions
CREATE TABLE "receipt_counters" (
    "id" TEXT PRIMARY KEY,
    "fiscal_year" INTEGER NOT NULL,
    "receipt_type" TEXT NOT NULL,
    "next_sequence" INTEGER NOT NULL DEFAULT 1,
    UNIQUE("fiscal_year", "receipt_type")
);

ALTER TABLE "transactions" ADD COLUMN "fiscal_year" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "receipt_sequence" INTEGER;
