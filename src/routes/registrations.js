const router = require("express").Router();
const { pool } = require("../db");
const { authenticate, adminOnly } = require("../middleware/auth");
const { sendMail } = require("../utils");

router.post("/:eventId", authenticate, async (req, res, next) => {
  if (req.user.role !== "student") return res.status(403).json({ error: "Only student accounts can register." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const eventResult = await client.query("SELECT * FROM events WHERE id=$1 FOR UPDATE", [req.params.eventId]);
    const event = eventResult.rows[0];
    if (!event) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Event not found." }); }
    if (new Date(event.event_date) <= new Date()) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Registration is closed because this event has started or ended." }); }
    if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
      await client.query("ROLLBACK"); return res.status(400).json({ error: "Registration deadline has passed." });
    }
    const count = await client.query("SELECT COUNT(*)::int AS n FROM registrations WHERE event_id=$1 AND status <> 'cancelled'", [event.id]);
    if (count.rows[0].n >= event.capacity) { await client.query("ROLLBACK"); return res.status(400).json({ error: "This event is full." }); }
    const userResult = await client.query("SELECT name,email,phone,department,year FROM users WHERE id=$1", [req.user.id]);
    const student = userResult.rows[0];
    await client.query(
      `INSERT INTO registrations(event_id,user_id,phone,department,year)
       VALUES($1,$2,$3,$4,$5)`,
      [event.id, req.user.id, student.phone, student.department, student.year]
    );
    await client.query("COMMIT");
    let emailSent = false;
    try {
      emailSent = await sendMail({
        to: student.email,
        subject: `Registration confirmed: ${event.title}`,
        text: `Hello ${student.name},\n\nYour registration for ${event.title} has been successfully confirmed on EventHub.\n\nEvent: ${event.title}\nDate: ${new Date(event.event_date).toLocaleString()}\nVenue: ${event.venue}\nRegistration status: CONFIRMED\n\nPlease keep this email for your reference. We look forward to seeing you!\n\nEventHub — College Events`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#18213b"><h2 style="color:#7158e8">EventHub registration confirmed</h2><p>Hello ${String(student.name).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))},</p><p>Your event registration has been successfully confirmed.</p><div style="background:#f6f4ff;padding:18px;border-radius:12px"><h3>${String(event.title).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}</h3><p><b>Date:</b> ${new Date(event.event_date).toLocaleString()}<br><b>Venue:</b> ${String(event.venue).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}<br><b>Status:</b> CONFIRMED</p></div><p>Please keep this email for your reference.</p><p>EventHub — College Events</p></div>`
      });
    } catch (e) { console.error("Registration email failed:", e.message); }
    res.status(201).json({ message: "Registration successful.", emailSent });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return res.status(409).json({ error: "You are already registered for this event." });
    next(err);
  } finally { client.release(); }
});

router.get("/mine/list", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT r.id AS registration_id,r.status,r.registered_at,e.*
      FROM registrations r JOIN events e ON e.id=r.event_id
      WHERE r.user_id=$1 ORDER BY r.registered_at DESC`, [req.user.id]);
    res.json({ registrations: result.rows });
  } catch (err) { next(err); }
});

router.patch("/:registrationId/cancel", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE registrations SET status='cancelled'
       WHERE id=$1 AND user_id=$2 AND status='registered' RETURNING id`,
      [req.params.registrationId, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Active registration not found." });
    res.json({ message: "Registration cancelled." });
  } catch (err) { next(err); }
});

router.get("/", authenticate, adminOnly, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT r.id,r.status,r.registered_at,u.name,u.email,u.phone,u.department,u.year,e.title AS event_title,e.id AS event_id
      FROM registrations r JOIN users u ON u.id=r.user_id JOIN events e ON e.id=r.event_id
      ORDER BY r.registered_at DESC`);
    res.json({ registrations: result.rows });
  } catch (err) { next(err); }
});

router.patch("/:registrationId/checkin", authenticate, adminOnly, async (req, res, next) => {
  try {
    const result = await pool.query(
      "UPDATE registrations SET status='attended' WHERE id=$1 AND status='registered' RETURNING id",
      [req.params.registrationId]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Active registration not found." });
    res.json({ message: "Attendance marked." });
  } catch (err) { next(err); }
});

module.exports = router;
