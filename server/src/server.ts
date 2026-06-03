import { exec } from "child_process";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { verifySMTP } from "./lib/email.js";
import { log } from "./lib/logger.js";
import { waitForDatabase } from "./lib/errors.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  log("info", `Server is running on port ${PORT}`);
  log("info", "Connecting to database...");
  try {
    await waitForDatabase(prisma, 15, 2000);
    log("info", "Database connected");
    // Run migrations asynchronously once DB is up
    exec("npx prisma migrate deploy 2>&1", { cwd: process.cwd(), timeout: 30000 }, (err) => {
      if (err) log("warn", `Migration skipped or failed: ${err.message?.slice(0, 100)}`);
      else log("info", "Migrations applied");
    });
  } catch {
    log("error", "Database unreachable — server running but DB queries will fail");
  }
  try { await verifySMTP(); } catch { log("warn", "SMTP not configured — email features disabled"); }
});
