const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const verifyToken = require("../middleware/auth");

const router = express.Router();


// User Registration API
router.post("/register", async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        // Public registration always creates a User account — Supporter/Manager
        // accounts can only be created by a Manager via /register-supporter.
        const assignedRole = 'User';

        const [existingUsers] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "Email is already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
            [full_name, email, hashedPassword, assignedRole]
        );

        res.status(201).json({
            message: "Registration successful!"
        });
    } catch (error) {
        console.error("Registration error:", error.message);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});

/* User Login API */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const [users] = await db.query(
            "SELECT id, full_name, email, password, role FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Sign a JWT that expires in 24 hours.
        const token = jwt.sign(
            {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            message: "Login failed",
        });
    }
});

/* ── Manager-only: Create a new Supporter account ── */
router.post("/register-supporter", verifyToken, async (req, res) => {
    try {
        // Only Managers are allowed to call this route
        if (req.user.role !== 'Manager') {
            return res.status(403).json({ message: "Access denied. Managers only." });
        }

        const { full_name, email, password } = req.body;

        if (!full_name || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const [existing] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, 'Supporter')",
            [full_name, email, hashedPassword]
        );

        res.status(201).json({ message: `Supporter account created for ${full_name}.` });
    } catch (error) {
        console.error("Create supporter error:", error.message);
        res.status(500).json({ message: "Failed to create supporter account." });
    }
});

/* ── One-time Manager Setup ──────────────────────────────────────────────────
 *
 * POST /api/auth/setup-manager
 *
 * Purpose : Bootstrap the single Manager account for the entire application.
 * Security: Requires a secret setup key stored only as a Render env variable.
 *           The key is NEVER stored in code or committed to git.
 * Guards  :
 *   1. Verifies the caller knows MANAGER_SETUP_KEY   → 401 if wrong
 *   2. Checks the DB for any existing Manager row    → 409 if one exists
 *   3. Rejects if MANAGER_SETUP_KEY is not configured → 500 (misconfigured)
 *
 * After the first Manager is created this endpoint becomes permanently
 * inoperable (step 2 always blocks it), so it is safe to leave registered.
 * ─────────────────────────────────────────────────────────────────────────── */
router.post("/setup-manager", async (req, res) => {
    try {
        // Guard: env var must be configured on the server
        if (!process.env.MANAGER_SETUP_KEY) {
            return res.status(500).json({
                message: "Server misconfiguration: MANAGER_SETUP_KEY is not set."
            });
        }

        const { setup_key, full_name, email, password } = req.body;

        // Guard: caller must supply the correct secret key
        if (!setup_key || setup_key !== process.env.MANAGER_SETUP_KEY) {
            return res.status(401).json({
                message: "Invalid setup key. Access denied."
            });
        }

        // Validate fields
        if (!full_name || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Manager password must be at least 8 characters."
            });
        }

        // Guard: only ONE Manager is allowed in the entire system
        const [existing] = await db.query(
            "SELECT id FROM users WHERE role = 'Manager' LIMIT 1"
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "A Manager account already exists. Setup is not allowed again."
            });
        }

        // Also prevent using an already-registered email
        const [emailCheck] = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (emailCheck.length > 0) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const hashedPassword = await bcrypt.hash(password, 12); // stronger cost for Manager

        await db.query(
            "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, 'Manager')",
            [full_name, email, hashedPassword]
        );

        res.status(201).json({
            message: `Manager account created for ${full_name}. This endpoint is now permanently locked.`
        });
    } catch (error) {
        console.error("Manager setup error:", error.message);
        res.status(500).json({ message: "Failed to create Manager account." });
    }
});

module.exports = router;
