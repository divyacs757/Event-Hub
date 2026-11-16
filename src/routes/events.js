const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { authenticate, adminOnly } = require("../middleware/auth");

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "..", "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    cb(ok ? null : new Error("Only image files and PDF pamphlets are allowed."), ok);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT e.*, COUNT(r.id) FILTER (WHERE r.status <> 'cancelled')::int AS registered_count
      FROM events e LEFT JOIN registrations r ON r.event_id=e.id
      GROUP BY e.id ORDER BY e.event_date ASC`);
    res.json({ events: result.rows });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT e.*, COUNT(r.id) FILTER (WHERE r.status <> 'cancelled')::int AS registered_count
      FROM events e LEFT JOIN registrations r ON r.event_id=e.id
      WHERE e.id=$1 GROUP BY e.id`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: "Event not found." });
    res.json({ event: result.rows[0] });
  } catch (err) { next(err); }
});

router.get("/:id/winners", async (req, res, next) => {
  try {
    const event = await pool.query("SELECT id,title,event_date FROM events WHERE id=$1", [req.params.id]);
    if (!event.rows[0]) return res.status(404).json({ error: "Event not found." });
    const winners = await pool.query(
      "SELECT position,winner_name,winner_user_id,prize_amount FROM event_winners WHERE event_id=$1 ORDER BY position", [req.params.id]
    );
    res.json({ event: event.rows[0], winners: winners.rows });
  } catch (err) { next(err); }
});

router.post("/", authenticate, adminOnly, upload.single("pamphlet"), async (req, res, next) => {
  try {
    const { title, description, category, venue, event_date, registration_deadline,
      capacity, registration_fee, prize_money, payment_instructions } = req.body;
    if (!title || !description || !venue || !event_date) return res.status(400).json({ error: "Title, description, venue and event date are required." });
    const pamphlet_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO events(title,description,category,venue,event_date,registration_deadline,capacity,
       registration_fee,prize_money,payment_instructions,pamphlet_url,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [title, description, category || "General", venue, event_date, registration_deadline || null,
       Number(capacity || 100), Number(registration_fee || 0), Number(prize_money || 0),
       payment_instructions || null, pamphlet_url, req.user.id]
    );
    res.status(201).json({ event: result.rows[0], message: "Event created." });
  } catch (err) { next(err); }
});

router.put("/:id", authenticate, adminOnly, upload.single("pamphlet"), async (req, res, next) => {
  try {
    const { title, description, category, venue, event_date, registration_deadline,
      capacity, registration_fee, prize_money, payment_instructions } = req.body;
    if (!title || !description || !venue || !event_date) {
      return res.status(400).json({ error: "Title, description, venue and event date are required." });
    }
    const existing = await pool.query("SELECT id,pamphlet_url FROM events WHERE id=$1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Event not found." });
    const count = await pool.query("SELECT COUNT(*)::int AS n FROM registrations WHERE event_id=$1 AND status <> 'cancelled'", [req.params.id]);
    const nextCapacity = Number(capacity || 100);
    if (!Number.isInteger(nextCapacity) || nextCapacity < 1) return res.status(400).json({ error: "Capacity must be at least 1." });
    if (nextCapacity < count.rows[0].n) return res.status(400).json({ error: `Capacity cannot be lower than the ${count.rows[0].n} active registrations.` });
    const pamphletUrl = req.file ? `/uploads/${req.file.filename}` : existing.rows[0].pamphlet_url;
    const result = await pool.query(
      `UPDATE events SET title=$1,description=$2,category=$3,venue=$4,event_date=$5,
       registration_deadline=$6,capacity=$7,registration_fee=$8,prize_money=$9,
       payment_instructions=$10,pamphlet_url=$11 WHERE id=$12 RETURNING *`,
      [title, description, category || "General", venue, event_date, registration_deadline || null,
       nextCapacity, Math.max(0, Number(registration_fee || 0)), Math.max(0, Number(prize_money || 0)),
       payment_instructions || null, pamphletUrl, req.params.id]
    );
    res.json({ event: result.rows[0], message: "Event updated successfully." });
  } catch (err) { next(err); }
});

router.delete("/:id", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM events WHERE id=$1 RETURNING id", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Event not found." });
    res.json({ message: "Event deleted." });
  } catch (err) { next(err); }
});

module.exports = router;
