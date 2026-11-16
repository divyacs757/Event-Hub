require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./src/routes/auth");
const eventRoutes = require("./src/routes/events");
const registrationRoutes = require("./src/routes/registrations");
const adminRoutes = require("./src/routes/admin");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing. Copy .env.example to .env and configure it.");
  process.exit(1);
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "public", "uploads");
app.use("/uploads", express.static(uploadDir));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));
app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok", service: "EventHub API" }));
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/admin", adminRoutes);
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error." });
});
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`EventHub running on port ${port}`));
