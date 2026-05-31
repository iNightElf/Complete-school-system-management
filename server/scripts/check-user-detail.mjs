import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const users = await p.user.findMany();
  console.log('Users:', JSON.stringify(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })), null, 2));
} catch (e) { console.error('Error:', e.message); }
finally { await p.$disconnect(); }
