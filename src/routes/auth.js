
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { authenticate } = require("../middleware/auth");
const { sendMail } = require("../utils");

function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

// STUDENT REGISTRATION
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, phone, department, year } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email and password are required."
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "Password must contain at least 8 characters."
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Please enter a valid college email address."
      });
    }

    // Allow only NIE email addresses when configured
    const allowedDomain = process.env.COLLEGE_EMAIL_DOMAIN;

    if (
      allowedDomain &&
      !normalizedEmail.endsWith("@" + allowedDomain.toLowerCase())
    ) {
      return res.status(400).json({
        error: `Please use your college email ending in @${allowedDomain}.`
      });
    }

    // Check whether email is already registered
    const duplicate = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [normalizedEmail]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({
        error: "This email address is already registered. Please log in instead."
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, phone, department, year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, phone, department, year`,
      [
        String(name).trim(),
        normalizedEmail,
        hash,
        phone || null,
        department || null,
        year || null
      ]
    );

    const user = result.rows[0];

    let emailSent = false;

    try {
      emailSent = await sendMail({
        to: user.email,
        subject: "Welcome to EventHub!",
        text: `Hello ${user.name}, your EventHub account has been created successfully.`
      });
    } catch (e) {
      console.error("Welcome email failed:", e.message);
    }

    return res.status(201).json({
      token: makeToken(user),
      user,
      emailSent,
      message: "Account created successfully."
    });

  } catch (err) {
    // PostgreSQL duplicate email protection
    if (err.code === "23505") {
      return res.status(409).json({
        error: "This email address is already registered. Please log in instead."
      });
    }

    next(err);
  }
});

// STUDENT AND ADMIN LOGIN
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      year: user.year
    };

    return res.json({
      token: makeToken(safeUser),
      user: safeUser,
      message: "Login successful."
    });

  } catch (err) {
    next(err);
  }
});

// GET CURRENT USER
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, phone, department, year
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        error: "Account not found."
      });
    }

    res.json({ user: result.rows[0] });

  } catch (err) {
    next(err);
  }
});

module.exports = router;