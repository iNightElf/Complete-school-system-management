import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

import { prisma } from "./lib/prisma.js";
import { sanitizeError, waitForDatabase } from "./lib/errors.js";
import { requestIdMiddleware, log } from "./lib/logger.js";
import * as students from "./controllers/student.controller.js";
import * as transactionCtrl from "./controllers/transaction.controller.js";
import * as openingBalanceCtrl from "./controllers/openingBalance.controller.js";
import * as reportCtrl from "./controllers/report.controller.js";
import * as closureCtrl from "./controllers/closure.controller.js";
import * as ops from "./controllers/ops.controller.js";
import * as classes from "./controllers/class.controller.js";
import * as results from "./controllers/result.controller.js";
import * as users from "./controllers/user.controller.js";
import * as settings from "./controllers/setting.controller.js";
import * as feeSchedule from "./controllers/feeSchedule.controller.js";
import * as feeWaiver from "./controllers/feeWaiver.controller.js";
import * as studentFeeAssignment from "./controllers/studentFeeAssignment.controller.js";
import * as setup from "./controllers/setup.controller.js";
import * as audit from "./controllers/audit.controller.js";
import * as authCtrl from "./controllers/auth.controller.js";
import * as academicYear from "./controllers/academicYear.controller.js";
import * as category from "./controllers/category.controller.js";
import { authenticate, authorizePermission } from "./middleware/auth.middleware.js";
import { idempotent } from "./lib/idempotency.js";

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

const app = express();

app.use(requestIdMiddleware);

app.use((req, res, next) => {
  log("info", `${req.method} ${req.path}`, { requestId: res.locals.requestId });
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", ...corsOrigins],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
}));

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const setupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many registration attempts. Try again later." } });
const financeWriteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Try again later." } });

app.use("/api/", globalLimiter);

// ── Setup (no auth — first-admin bootstrap) ──
app.get("/api/setup/status", setup.getSetupStatus);
app.post("/api/setup/init", setupLimiter, idempotent(setup.initSetup));

// ── School Settings ──
app.get("/api/settings", authenticate, settings.getSettings);
app.put("/api/settings", authenticate, authorizePermission("finance:admin"), idempotent(settings.updateSettings));

// Auth routes — session verification via Supabase JWT
app.get("/api/auth/get-session", authenticate, authCtrl.getSession);

// ── Users (admin) ──
app.get("/api/users", authenticate, authorizePermission("users:read"), users.getAllUsers);
app.get("/api/users/roles", authenticate, authorizePermission("users:read"), users.getRoles);
app.put("/api/users/:id/role", authenticate, authorizePermission("users:write"), users.updateUserRole);
app.delete("/api/users/:id", authenticate, authorizePermission("users:write"), users.deleteUser);

// ── Students ──
app.get("/api/students", authenticate, authorizePermission("students:read"), students.getAllStudents);
app.post("/api/students", authenticate, authorizePermission("students:write"), idempotent(students.createStudent));
app.post("/api/students/import", authenticate, authorizePermission("students:write"), idempotent(students.importStudents));
app.put("/api/students/:id", authenticate, authorizePermission("students:write"), students.updateStudent);
app.delete("/api/students/:id", authenticate, authorizePermission("students:write"), students.deleteStudent);
app.get("/api/students/:id/photo", authenticate, authorizePermission("students:read"), students.getStudentPhoto);
app.post("/api/students/:id/restore", authenticate, authorizePermission("students:write"), students.restoreStudent);
app.post("/api/students/:id/graduate", authenticate, authorizePermission("students:write"), idempotent(students.graduateStudent));
app.post("/api/students/:id/ungraduate", authenticate, authorizePermission("students:write"), idempotent(students.ungraduateStudent));
app.post("/api/classes/:classId/graduate", authenticate, authorizePermission("students:write"), idempotent(students.graduateClass));

// ── Teachers ──
app.get("/api/teachers", authenticate, authorizePermission("teachers:read"), ops.getAllTeachers);
app.post("/api/teachers", authenticate, authorizePermission("teachers:write"), idempotent(ops.createTeacher));
app.post("/api/teachers/import", authenticate, authorizePermission("teachers:write"), idempotent(ops.importTeachers));
app.put("/api/teachers/:id", authenticate, authorizePermission("teachers:write"), ops.updateTeacher);
app.delete("/api/teachers/:id", authenticate, authorizePermission("teachers:write"), ops.deleteTeacher);
app.get("/api/teachers/:id/photo", authenticate, authorizePermission("teachers:read"), ops.getTeacherPhoto);
app.post("/api/teachers/:id/restore", authenticate, authorizePermission("teachers:write"), ops.restoreTeacher);

// ── Staff ──
app.get("/api/staff", authenticate, authorizePermission("staff:read"), ops.getAllStaff);
app.post("/api/staff", authenticate, authorizePermission("staff:write"), idempotent(ops.createStaff));
app.post("/api/staff/import", authenticate, authorizePermission("staff:write"), idempotent(ops.importStaff));
app.put("/api/staff/:id", authenticate, authorizePermission("staff:write"), ops.updateStaff);
app.delete("/api/staff/:id", authenticate, authorizePermission("staff:write"), ops.deleteStaff);
app.get("/api/staff/:id/photo", authenticate, authorizePermission("staff:read"), ops.getStaffPhoto);
app.post("/api/staff/:id/restore", authenticate, authorizePermission("staff:write"), ops.restoreStaff);

// ── Books (Accessories) ──
app.get("/api/books", authenticate, authorizePermission("books:read"), ops.getAllBooks);
app.post("/api/books", authenticate, authorizePermission("books:write"), idempotent(ops.createBook));
app.put("/api/books/:id", authenticate, authorizePermission("books:write"), ops.updateBook);
app.delete("/api/books/:id", authenticate, authorizePermission("books:write"), ops.deleteBook);

// ── Classes ──
app.get("/api/classes", authenticate, authorizePermission("classes:read"), classes.getAllClasses);
app.post("/api/classes", authenticate, authorizePermission("classes:write"), idempotent(classes.createClass));
app.delete("/api/classes/:id", authenticate, authorizePermission("classes:write"), classes.deleteClass);
app.put("/api/classes/reorder", authenticate, authorizePermission("classes:write"), classes.reorderClasses);
app.post("/api/classes/promote-all", authenticate, authorizePermission("classes:write"), idempotent(classes.promoteAll));

// ── Subjects ──
app.get("/api/classes/:classId/subjects", authenticate, authorizePermission("subjects:read"), results.getSubjectsByClass);
app.post("/api/classes/:classId/subjects", authenticate, authorizePermission("subjects:write"), idempotent(results.createSubject));
app.put("/api/subjects/:id", authenticate, authorizePermission("subjects:write"), results.updateSubject);
app.delete("/api/subjects/:id", authenticate, authorizePermission("subjects:write"), results.deleteSubject);

// ── Results ──
app.get("/api/students/:id/results", authenticate, authorizePermission("results:read"), results.getStudentResults);
app.post("/api/students/:id/results", authenticate, authorizePermission("results:write"), results.saveStudentResult);
app.get("/api/classes/:classId/results", authenticate, authorizePermission("results:read"), results.getClassResults);
app.delete("/api/classes/:classId/results", authenticate, authorizePermission("results:write"), results.deleteClassResultsOnly);
app.delete("/api/classes/:classId/subjects", authenticate, authorizePermission("subjects:write"), results.deleteClassSubjects);

// ── Academic Years ──
app.get("/api/academic-years", authenticate, authorizePermission("academic-years:read"), academicYear.getAcademicYears);
app.post("/api/academic-years", authenticate, authorizePermission("academic-years:write"), academicYear.createAcademicYear);
app.put("/api/academic-years/:id", authenticate, authorizePermission("academic-years:write"), academicYear.updateAcademicYear);

// ── Categories ──
app.get("/api/categories", authenticate, category.getCategories);
app.post("/api/categories", authenticate, authorizePermission("finance:write"), category.createCategory);
app.put("/api/categories/:id", authenticate, authorizePermission("finance:write"), category.updateCategory);
app.delete("/api/categories/:id", authenticate, authorizePermission("finance:write"), category.deleteCategory);

// ── Fee Schedules ──
app.get("/api/finance/fee-schedules", authenticate, authorizePermission("finance:read"), feeSchedule.getFeeSchedules);
app.post("/api/finance/fee-schedules", authenticate, authorizePermission("finance:write"), idempotent(feeSchedule.createFeeSchedule));
app.post("/api/finance/fee-schedules/copy-from-year", authenticate, authorizePermission("finance:write"), idempotent(feeSchedule.copyFeeSchedulesFromYear));
app.put("/api/finance/fee-schedules/:id", authenticate, authorizePermission("finance:write"), feeSchedule.updateFeeSchedule);
app.delete("/api/finance/fee-schedules/:id", authenticate, authorizePermission("finance:write"), feeSchedule.deleteFeeSchedule);

// ── Fee Waivers ──
app.get("/api/finance/fee-waivers", authenticate, authorizePermission("finance:read"), feeWaiver.getFeeWaivers);
app.post("/api/finance/fee-waivers", authenticate, authorizePermission("finance:write"), idempotent(feeWaiver.createFeeWaiver));
app.put("/api/finance/fee-waivers/:id", authenticate, authorizePermission("finance:write"), feeWaiver.updateFeeWaiver);
app.post("/api/finance/fee-waivers/:id/deactivate", authenticate, authorizePermission("finance:write"), feeWaiver.deactivateFeeWaiver);

// ── Finance ──
app.get("/api/finance/balances", authenticate, authorizePermission("finance:read"), transactionCtrl.getBalances);
app.get("/api/finance/ledger", authenticate, authorizePermission("finance:read"), transactionCtrl.getLedger);
app.get("/api/finance/transactions", authenticate, authorizePermission("finance:read"), transactionCtrl.getTransactions);
app.post("/api/finance/transactions", financeWriteLimiter, authenticate, authorizePermission("finance:write"), idempotent(transactionCtrl.createTransaction));
app.post("/api/finance/transactions/:id/cancel", authenticate, authorizePermission("finance:write"), idempotent(transactionCtrl.cancelTransaction));
app.get("/api/finance/fee-status", authenticate, authorizePermission("finance:read"), transactionCtrl.getFeeStatus);

// ── Student Fee Assignments ──
app.get("/api/finance/student-fee-assignments", authenticate, authorizePermission("finance:read"), studentFeeAssignment.getStudentFeeAssignments);
app.post("/api/finance/student-fee-assignments/toggle", authenticate, authorizePermission("finance:write"), idempotent(studentFeeAssignment.toggleStudentFeeAssignment));
app.post("/api/finance/student-fee-assignments/bulk", authenticate, authorizePermission("finance:write"), idempotent(studentFeeAssignment.bulkAssign));

// ── Opening Balances ──
app.get("/api/finance/opening-balances", authenticate, authorizePermission("finance:read"), openingBalanceCtrl.getOpeningBalances);
app.put("/api/finance/opening-balances", authenticate, authorizePermission("finance:write"), openingBalanceCtrl.setOpeningBalances);
app.get("/api/finance/opening-balances/history", authenticate, authorizePermission("finance:read"), openingBalanceCtrl.getOpeningBalanceHistory);
app.post("/api/finance/opening-balances/revert/:id", authenticate, authorizePermission("finance:write"), idempotent(openingBalanceCtrl.revertOpeningBalance));

// ── Reports ──
app.get("/api/finance/reports/agm", authenticate, authorizePermission("finance:read"), reportCtrl.getAGMReport);
app.get("/api/finance/defaulter", authenticate, authorizePermission("finance:read"), reportCtrl.getDefaulterReport);

// ── Period Close ──
app.get("/api/finance/period-closes", authenticate, authorizePermission("finance:read"), closureCtrl.getPeriodCloses);
app.post("/api/finance/period-closes", authenticate, authorizePermission("finance:admin"), idempotent(closureCtrl.closePeriod));
app.delete("/api/finance/period-closes/:fiscalYear", authenticate, authorizePermission("finance:admin"), closureCtrl.reopenPeriod);

// ── Reconciliation ──
app.get("/api/finance/reconciliations", authenticate, authorizePermission("finance:read"), closureCtrl.getReconciliations);
app.post("/api/finance/reconciliations", authenticate, authorizePermission("finance:admin"), idempotent(closureCtrl.createReconciliation));
app.get("/api/finance/reconciliations/:id", authenticate, authorizePermission("finance:read"), closureCtrl.getReconciliationDetail);

// ── Audit Logs ──
app.get("/api/audit", authenticate, authorizePermission("audit:read"), audit.getAuditLogs);
app.get("/api/audit/actions", authenticate, authorizePermission("audit:read"), audit.getAuditActions);
app.get("/api/audit/entity-types", authenticate, authorizePermission("audit:read"), audit.getAuditEntityTypes);

// Wake DB (client calls this on load to warm up Neon)
app.get("/api/wake-db", async (_req, res) => {
  try {
    await waitForDatabase(prisma, 20, 1500);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ error: "Database unreachable" });
  }
});

// Health Check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.json({ status: "ok", database: "connecting" });
  }
});

// ── API 404 handler — unmatched /api/* routes return JSON, not SPA HTML ──
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// ── Serve client build in production ──
const clientDist = join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'));
});

// Global error handler — prevents crashes from becoming 502s
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log("error", err?.message || "Unknown error", {
    requestId: res.locals.requestId,
    stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
  });
  const message = process.env.NODE_ENV === "production"
    ? sanitizeError(err)
    : err?.message || "Internal server error";
  res.status(err?.status || err?.statusCode || 500).json({ error: message });
});

export default app;
