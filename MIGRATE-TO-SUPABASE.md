# Migrate to Supabase

This guide migrates from any PostgreSQL (Neon, local, etc.) to Supabase with zero code changes.

---

## Prerequisites

- Supabase project created at https://supabase.com
- `pg_dump` and `psql` installed locally (PostgreSQL client tools)
- Your old database accessible (current `DATABASE_URL`)

---

## Step 1: Get Your Supabase Connection String

1. Open your Supabase project dashboard
2. Go to **Project Settings → Database → Connection string**
3. Copy the **Direct connection** string (port **5432**, NOT the pooled port 6543)
   - Format: `postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres?sslmode=require`
4. Update `server/.env`:
   ```
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_REF.supabase.co:5432/postgres?sslmode=require"
   ```

---

## Step 2: Run Migrations on Supabase

```bash
cd server
npx prisma migrate deploy
```

This creates all tables in your Supabase database.

---

## Step 3: Export Data from Old Database

```bash
# Replace with your current DATABASE_URL
pg_dump --no-owner --no-acl --data-only \
  "postgresql://old-user:old-pass@old-host:5432/old-db?sslmode=require" \
  > dump.sql
```

---

## Step 4: Import into Supabase

```bash
psql "$DATABASE_URL" < dump.sql
```

**Note:** Expect a few `duplicate key` or `already exists` errors for auth-related sequences — these are harmless.

---

## Step 5: Generate Prisma Client

```bash
cd server
npx prisma generate
```

---

## Step 6: Verify

```bash
cd server
npm run dev
```

Open `http://localhost:5173` and confirm:
- Login works with existing credentials
- Students, teachers, staff data appears
- Finance transactions show correct balances
- Results render correctly

---

## Rollback

To go back to your old database, just restore `server/.env` to the old `DATABASE_URL` and restart.

---

## Supabase Free Tier Limits

| Resource | Limit | School usage |
|----------|-------|-------------|
| Database | 500 MB | Plenty for < 5000 students with BYTEA photos |
| File storage | 1 GB | Only relevant if migrating photos later |
| Monthly active users | 50,000 | More than enough |
| Daily backups | Yes, 7-day retention | Included free |

**Important:** Free tier Supabase pauses after 7 days of inactivity. A school using this daily will never hit this limit.

---

## Optional: Switch to Supabase Auth Later

Prisma with the direct connection port works 100% with Better Auth on Supabase. No auth migration needed unless you want to use Supabase's built-in auth features (magic links, OAuth, etc).
