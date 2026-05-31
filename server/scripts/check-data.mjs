import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const schemas = await p.$queryRawUnsafe(`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`);
  console.log('Schemas:', schemas.map(s => s.schema_name).join(', '));
  
  const userCount = await p.user.count();
  console.log('user count:', userCount);
  
  const sessionCount = await p.session.count();
  console.log('session count:', sessionCount);

  const accountCount = await p.account.count();
  console.log('account count:', accountCount);

  const studentCount = await p.student.count();
  console.log('student count:', studentCount);

  const txCount = await p.transaction.count();
  console.log('transaction count:', txCount);

  // Check if there are any tables in other schemas with user data
  for (const schema of schemas) {
    if (schema.schema_name !== 'public' && !schema.schema_name.startsWith('pg_') && schema.schema_name !== 'information_schema') {
      const tbls = await p.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1`, schema.schema_name);
      if (tbls.length > 0) {
        console.log(`Schema "${schema.schema_name}" tables:`, tbls.map(t => t.table_name).join(', '));
      }
    }
  }

  // Check if there's a _prisma_migrations entry with a reset/truncate
  const migs = await p.$queryRawUnsafe(`SELECT migration_name, finished_at, migration_file_name, logs, rolled_back_at FROM _prisma_migrations ORDER BY started_at`);
  for (const m of migs) {
    console.log(`Migration: ${m.migration_name}, finished: ${m.finished_at}, rolled_back: ${m.rolled_back_at}`);
    if (m.logs) console.log(`  Logs: ${m.logs}`);
  }

} catch (e) { console.error('Error:', e.message); }
finally { await p.$disconnect(); }
