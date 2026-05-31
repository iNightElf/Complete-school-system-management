import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const tables = await p.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
  console.log('Tables:', tables.map(t => t.table_name).join(', '));
  const users = await p.user.findMany({ take: 5 });
  console.log('Users count:', users.length);
  const migs = await p.$queryRawUnsafe(`SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC`);
  console.log('Migrations:', migs.map(m => m.migration_name).join(', '));
} catch (e) { console.error(e.message); }
finally { await p.$disconnect(); }
