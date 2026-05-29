import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";

import * as auth from "./controllers/auth.controller.js";
import * as students from "./controllers/student.controller.js";
import * as finance from "./controllers/finance.controller.js";
import * as ops from "./controllers/ops.controller.js";
import { authenticate, authorize } from "./middleware/auth.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth
app.post("/api/auth/register", auth.register);
app.post("/api/auth/login", auth.login);

// Students
app.get("/api/students", authenticate, students.getAllStudents);
app.post("/api/students", authenticate, authorize(["admin"]), students.createStudent);
app.put("/api/students/:id", authenticate, authorize(["admin"]), students.updateStudent);
app.delete("/api/students/:id", authenticate, authorize(["admin"]), students.deleteStudent);

// Finance
app.get("/api/finance/balances", authenticate, finance.getBalances);
app.get("/api/finance/transactions", authenticate, finance.getTransactions);
app.post("/api/finance/transactions", authenticate, authorize(["admin"]), finance.createTransaction);

// Ops (Teachers, Staff, Books)
app.get("/api/teachers", authenticate, ops.getAllTeachers);
app.post("/api/teachers", authenticate, authorize(["admin"]), ops.createTeacher);

app.get("/api/staff", authenticate, ops.getAllStaff);
app.post("/api/staff", authenticate, authorize(["admin"]), ops.createStaff);

app.get("/api/books", authenticate, ops.getAllBooks);
app.post("/api/books", authenticate, authorize(["admin"]), ops.createBook);

// Health Check
app.get("/health", (req, res) => res.json({ status: "ok" }));

export default app;
