import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";

import { auth } from "./lib/auth.js";
import { toNodeHandler } from "better-auth/node";
import * as students from "./controllers/student.controller.js";
import * as finance from "./controllers/finance.controller.js";
import * as ops from "./controllers/ops.controller.js";
import * as classes from "./controllers/class.controller.js";
import * as results from "./controllers/result.controller.js";
import * as users from "./controllers/user.controller.js";
import { authenticate, authorizePermission } from "./middleware/auth.middleware.js";

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

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
app.get("/api/students/:id/photo", students.getStudentPhoto);

// ── Teachers ──
app.get("/api/teachers", authenticate, authorizePermission("teachers:read"), ops.getAllTeachers);
app.post("/api/teachers", authenticate, authorizePermission("teachers:write"), ops.createTeacher);
app.put("/api/teachers/:id", authenticate, authorizePermission("teachers:write"), ops.updateTeacher);
app.delete("/api/teachers/:id", authenticate, authorizePermission("teachers:write"), ops.deleteTeacher);
app.get("/api/teachers/:id/photo", ops.getTeacherPhoto);

// ── Staff ──
app.get("/api/staff", authenticate, authorizePermission("staff:read"), ops.getAllStaff);
app.post("/api/staff", authenticate, authorizePermission("staff:write"), ops.createStaff);
app.put("/api/staff/:id", authenticate, authorizePermission("staff:write"), ops.updateStaff);
app.delete("/api/staff/:id", authenticate, authorizePermission("staff:write"), ops.deleteStaff);
app.get("/api/staff/:id/photo", ops.getStaffPhoto);

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

// ── Finance ──
app.get("/api/finance/balances", authenticate, authorizePermission("finance:read"), finance.getBalances);
app.get("/api/finance/transactions", authenticate, authorizePermission("finance:read"), finance.getTransactions);
app.post("/api/finance/transactions", authenticate, authorizePermission("finance:write"), finance.createTransaction);

// Health Check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

export default app;
