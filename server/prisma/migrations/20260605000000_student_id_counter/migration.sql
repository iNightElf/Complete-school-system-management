-- Create counter table for atomic student ID generation
CREATE TABLE "student_id_counters" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'S',
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "pad_length" INTEGER NOT NULL DEFAULT 6,
    CONSTRAINT "student_id_counters_pkey" PRIMARY KEY ("id")
);

-- Seed the counter from the current max student ID
INSERT INTO "student_id_counters" ("id", "prefix", "next_value", "pad_length")
SELECT
    'singleton',
    'S',
    COALESCE(
        (SELECT MAX(NULLIF(regexp_replace("student_id", '\D', '', 'g'), ''))::INTEGER + 1 FROM "Student"),
        1
    ),
    6;
