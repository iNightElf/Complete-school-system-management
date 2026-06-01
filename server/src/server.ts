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
  } catch {
    log("error", "Database unreachable — server running but DB queries will fail");
  }
  try { await verifySMTP(); } catch { log("warn", "SMTP not configured — email features disabled"); }
});
