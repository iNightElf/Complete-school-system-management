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
import { authenticate, authorize } from "./middleware/auth.middleware.js";

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

// Students
app.get("/api/students", authenticate, students.getAllStudents);
app.post("/api/students", authenticate, authorize(["admin"]), students.createStudent);
app.put("/api/students/:id", authenticate, authorize(["admin"]), students.updateStudent);
app.delete("/api/students/:id", authenticate, authorize(["admin"]), students.deleteStudent);
app.get("/api/students/:id/photo", students.getStudentPhoto);

// Teachers
app.get("/api/teachers", authenticate, ops.getAllTeachers);
app.post("/api/teachers", authenticate, authorize(["admin"]), ops.createTeacher);
app.put("/api/teachers/:id", authenticate, authorize(["admin"]), ops.updateTeacher);
app.delete("/api/teachers/:id", authenticate, authorize(["admin"]), ops.deleteTeacher);
app.get("/api/teachers/:id/photo", ops.getTeacherPhoto);

// Staff
app.get("/api/staff", authenticate, ops.getAllStaff);
app.post("/api/staff", authenticate, authorize(["admin"]), ops.createStaff);
app.put("/api/staff/:id", authenticate, authorize(["admin"]), ops.updateStaff);
app.delete("/api/staff/:id", authenticate, authorize(["admin"]), ops.deleteStaff);
app.get("/api/staff/:id/photo", ops.getStaffPhoto);

// Books (Accessories)
app.get("/api/books", authenticate, ops.getAllBooks);
app.post("/api/books", authenticate, authorize(["admin"]), ops.createBook);
app.put("/api/books/:id", authenticate, authorize(["admin"]), ops.updateBook);
app.delete("/api/books/:id", authenticate, authorize(["admin"]), ops.deleteBook);

// Classes
app.get("/api/classes", authenticate, classes.getAllClasses);
app.post("/api/classes", authenticate, authorize(["admin"]), classes.createClass);
app.delete("/api/classes/:id", authenticate, authorize(["admin"]), classes.deleteClass);
app.put("/api/classes/reorder", authenticate, authorize(["admin"]), classes.reorderClasses);

// Subjects
app.get("/api/classes/:classId/subjects", authenticate, results.getSubjectsByClass);
app.post("/api/classes/:classId/subjects", authenticate, authorize(["admin"]), results.createSubject);
app.put("/api/subjects/:id", authenticate, authorize(["admin"]), results.updateSubject);
app.delete("/api/subjects/:id", authenticate, authorize(["admin"]), results.deleteSubject);

// Results
app.get("/api/students/:id/results", authenticate, results.getStudentResults);
app.post("/api/students/:id/results", authenticate, authorize(["admin"]), results.saveStudentResult);
app.get("/api/classes/:classId/results", authenticate, results.getClassResults);
app.delete("/api/classes/:classId/results", authenticate, authorize(["admin"]), results.deleteClassResults);

// Finance
app.get("/api/finance/balances", authenticate, finance.getBalances);
app.get("/api/finance/transactions", authenticate, finance.getTransactions);
app.post("/api/finance/transactions", authenticate, authorize(["admin"]), finance.createTransaction);

// Health Check
app.get("/health", (req, res) => res.json({ status: "ok" }));

export default app;
