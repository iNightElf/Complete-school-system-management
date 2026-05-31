import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

import { auth } from "./lib/auth.js";
import { prisma } from "./lib/prisma.js";
import { requestIdMiddleware, log } from "./lib/logger.js";
import { toNodeHandler } from "better-auth/node";
import * as students from "./controllers/student.controller.js";
import * as finance from "./controllers/finance.controller.js";
import * as ops from "./controllers/ops.controller.js";
import * as classes from "./controllers/class.controller.js";
import * as results from "./controllers/result.controller.js";
import * as users from "./controllers/user.controller.js";
import * as feeSchedule from "./controllers/feeSchedule.controller.js";
import * as feeWaiver from "./controllers/feeWaiver.controller.js";
import * as studentFeeAssignment from "./controllers/studentFeeAssignment.controller.js";
import * as setup from "./controllers/setup.controller.js";
import * as audit from "./controllers/audit.controller.js";
import { authenticate, authorizePermission } from "./middleware/auth.middleware.js";

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
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.use("/api/", globalLimiter);
app.use("/api/auth/", authLimiter);

// ── Setup (no auth — first-admin bootstrap) ──
app.get("/api/setup/status", setup.getSetupStatus);
app.post("/api/setup/init", setup.initSetup);

// Better-Auth handler — must come before other routes
app.use("/api/auth", toNodeHandler(auth));

// ── Users (admin) ──
app.get("/api/users", authenticate, authorizePermission("users:read"), users.getAllUsers);
app.get("/api/users/roles", authenticate, authorizePermission("users:read"), users.getRoles);
app.put("/api/users/:id/role", authenticate, authorizePermission("users:write"), users.updateUserRole);
app.delete("/api/users/:id", authenticate, authorizePermission("users:write"), users.deleteUser);

// ── Students ──
app.get("/api/students", authenticate, authorizePermission("students:read"), students.getAllStudents);
app.post("/api/students", authenticate, authorizePermission("students:write"), students.createStudent);
app.put("/api/students/:id", authenticate, authorizePermission("students:write"), students.updateStudent);
app.delete("/api/students/:id", authenticate, authorizePermission("students:write"), students.deleteStudent);
app.get("/api/students/:id/photo", authenticate, authorizePermission("students:read"), students.getStudentPhoto);

// ── Teachers ──
app.get("/api/teachers", authenticate, authorizePermission("teachers:read"), ops.getAllTeachers);
app.post("/api/teachers", authenticate, authorizePermission("teachers:write"), ops.createTeacher);
app.put("/api/teachers/:id", authenticate, authorizePermission("teachers:write"), ops.updateTeacher);
app.delete("/api/teachers/:id", authenticate, authorizePermission("teachers:write"), ops.deleteTeacher);
app.get("/api/teachers/:id/photo", authenticate, authorizePermission("teachers:read"), ops.getTeacherPhoto);

// ── Staff ──
app.get("/api/staff", authenticate, authorizePermission("staff:read"), ops.getAllStaff);
app.post("/api/staff", authenticate, authorizePermission("staff:write"), ops.createStaff);
app.put("/api/staff/:id", authenticate, authorizePermission("staff:write"), ops.updateStaff);
app.delete("/api/staff/:id", authenticate, authorizePermission("staff:write"), ops.deleteStaff);
app.get("/api/staff/:id/photo", authenticate, authorizePermission("staff:read"), ops.getStaffPhoto);

// ── Books (Accessories) ──
app.get("/api/books", authenticate, authorizePermission("books:read"), ops.getAllBooks);
app.post("/api/books", authenticate, authorizePermission("books:write"), ops.createBook);
app.put("/api/books/:id", authenticate, authorizePermission("books:write"), ops.updateBook);
app.delete("/api/books/:id", authenticate, authorizePermission("books:write"), ops.deleteBook);

// ── Classes ──
app.get("/api/classes", authenticate, authorizePermission("classes:read"), classes.getAllClasses);
app.post("/api/classes", authenticate, authorizePermission("classes:write"), classes.createClass);
app.delete("/api/classes/:id", authenticate, authorizePermission("classes:write"), classes.deleteClass);
app.put("/api/classes/reorder", authenticate, authorizePermission("classes:write"), classes.reorderClasses);

// ── Subjects ──
app.get("/api/classes/:classId/subjects", authenticate, authorizePermission("subjects:read"), results.getSubjectsByClass);
app.post("/api/classes/:classId/subjects", authenticate, authorizePermission("subjects:write"), results.createSubject);
app.put("/api/subjects/:id", authenticate, authorizePermission("subjects:write"), results.updateSubject);
app.delete("/api/subjects/:id", authenticate, authorizePermission("subjects:write"), results.deleteSubject);

// ── Results ──
app.get("/api/students/:id/results", authenticate, authorizePermission("results:read"), results.getStudentResults);
app.post("/api/students/:id/results", authenticate, authorizePermission("results:write"), results.saveStudentResult);
app.get("/api/classes/:classId/results", authenticate, authorizePermission("results:read"), results.getClassResults);
app.delete("/api/classes/:classId/results", authenticate, authorizePermission("results:write"), results.deleteClassResults);

// ── Academic Years ──
app.get("/api/academic-years", authenticate, async (_req, res) => {
  const years = await prisma.academicYear.findMany({ orderBy: { startDate: "desc" } });
  res.json(years);
});

// ── Fee Schedules ──
app.get("/api/finance/fee-schedules", authenticate, authorizePermission("finance:read"), feeSchedule.getFeeSchedules);
app.post("/api/finance/fee-schedules", authenticate, authorizePermission("finance:write"), feeSchedule.createFeeSchedule);
app.put("/api/finance/fee-schedules/:id", authenticate, authorizePermission("finance:write"), feeSchedule.updateFeeSchedule);
app.delete("/api/finance/fee-schedules/:id", authenticate, authorizePermission("finance:write"), feeSchedule.deleteFeeSchedule);

// ── Fee Waivers ──
app.get("/api/finance/fee-waivers", authenticate, authorizePermission("finance:read"), feeWaiver.getFeeWaivers);
app.post("/api/finance/fee-waivers", authenticate, authorizePermission("finance:write"), feeWaiver.createFeeWaiver);
app.put("/api/finance/fee-waivers/:id", authenticate, authorizePermission("finance:write"), feeWaiver.updateFeeWaiver);
app.post("/api/finance/fee-waivers/:id/deactivate", authenticate, authorizePermission("finance:write"), feeWaiver.deactivateFeeWaiver);

// ── Finance ──
app.get("/api/finance/balances", authenticate, authorizePermission("finance:read"), finance.getBalances);
app.get("/api/finance/transactions", authenticate, authorizePermission("finance:read"), finance.getTransactions);
app.post("/api/finance/transactions", authenticate, authorizePermission("finance:write"), finance.createTransaction);
app.post("/api/finance/transactions/:id/cancel", authenticate, authorizePermission("finance:write"), finance.cancelTransaction);

// ── Student Fee Assignments ──
app.get("/api/finance/student-fee-assignments", authenticate, authorizePermission("finance:read"), studentFeeAssignment.getStudentFeeAssignments);
app.post("/api/finance/student-fee-assignments/toggle", authenticate, authorizePermission("finance:write"), studentFeeAssignment.toggleStudentFeeAssignment);
app.post("/api/finance/student-fee-assignments/bulk", authenticate, authorizePermission("finance:write"), studentFeeAssignment.bulkAssign);

// ── Opening Balances ──
app.get("/api/finance/opening-balances", authenticate, authorizePermission("finance:read"), finance.getOpeningBalances);
app.put("/api/finance/opening-balances", authenticate, authorizePermission("finance:write"), finance.setOpeningBalances);
app.get("/api/finance/opening-balances/history", authenticate, authorizePermission("finance:read"), finance.getOpeningBalanceHistory);
app.post("/api/finance/opening-balances/revert/:id", authenticate, authorizePermission("finance:write"), finance.revertOpeningBalance);

// ── Reports ──
app.get("/api/finance/reports/agm", authenticate, authorizePermission("finance:read"), finance.getAGMReport);
app.get("/api/finance/defaulter", authenticate, authorizePermission("finance:read"), finance.getDefaulterReport);

// ── Period Close ──
app.get("/api/finance/period-closes", authenticate, authorizePermission("finance:write"), finance.getPeriodCloses);
app.post("/api/finance/period-closes", authenticate, authorizePermission("finance:admin"), finance.closePeriod);
app.delete("/api/finance/period-closes/:fiscalYear", authenticate, authorizePermission("finance:admin"), finance.reopenPeriod);

// ── Reconciliation ──
app.get("/api/finance/reconciliations", authenticate, authorizePermission("finance:read"), finance.getReconciliations);
app.post("/api/finance/reconciliations", authenticate, authorizePermission("finance:admin"), finance.createReconciliation);

// ── Audit Logs ──
app.get("/api/audit", authenticate, authorizePermission("audit:read"), audit.getAuditLogs);
app.get("/api/audit/actions", authenticate, authorizePermission("audit:read"), audit.getAuditActions);
app.get("/api/audit/entity-types", authenticate, authorizePermission("audit:read"), audit.getAuditEntityTypes);

// Health Check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

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
    ? "Internal server error"
    : err?.message || "Internal server error";
  res.status(err?.status || err?.statusCode || 500).json({ error: message });
});

export default app;
