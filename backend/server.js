require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const db      = require("./db");
const authRoutes   = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");

const app = express();

// ── Allow ALL origins (safe for local development) ──────────────────────────
app.use(cors());

// ── Manually handle CORS preflight for PATCH / PUT / DELETE ─────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Respond immediately to preflight and stop
  if (req.method === "OPTIONS") {
    return res.status(204).send();
  }
  next();
});

app.use(express.json());

app.use("/api/auth",    authRoutes);
app.use("/api/tickets", ticketRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "HelpDesk Lite backend is running!" });
});

// MySQL connection test
app.get("/api/health/db", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ message: "MySQL connected successfully!" });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(500).json({ message: "Database connection failed", error: error.message });
  }
});

// ── 404 catch-all — always return JSON, never an HTML page ──────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Keep the process alive and log any crash
process.on("uncaughtException",  (err)    => console.error("Uncaught Exception:",  err.message));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));

const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`HelpDesk Lite server running on port ${PORT}`);
});
server.on("error", (err) => console.error("Server error:", err.message));
