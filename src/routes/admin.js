const router = require("express").Router();
const { pool } = require("../db");
const { authenticate, adminOnly } = require("../middleware/auth");
const bcrypt = require("bcryptjs");
const { sendMail } = require("../utils");

router.use(authenticate, adminOnly);

router.get("/overview", async (_req, res, next) => {
  try {
    const [users, events, regs] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role='student'"),
      pool.query("SELECT COUNT(*)::int AS count FROM events"),
      pool.query("SELECT COUNT(*)::int AS count FROM registrations WHERE status <> 'cancelled'")
    ]);
    res.json({ students: users.rows[0].count, events: events.rows[0].count, registrations: regs.rows[0].count });
  } catch (err) { next(err); }
});

router.get("/students", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id,name,email,phone,department,year,created_at FROM users WHERE role='student' ORDER BY name"
    );
    res.json({ students: result.rows });
  } catch (err) { next(err); }
});


router.put("/students/:studentId", async (req, res, next) => {
  try {
    const { name, email, phone, department, year, password } = req.body;
    if (!String(name || "").trim() || !String(email || "").trim()) {
      return res.status(400).json({ error: "Student name and email are required." });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    let result;
    if (password && String(password).length < 8) return res.status(400).json({ error: "New password must contain at least 8 characters." });
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      result = await pool.query(
        `UPDATE users SET name=$1,email=$2,phone=$3,department=$4,year=$5,password_hash=$6
         WHERE id=$7 AND role='student' RETURNING id,name,email,phone,department,year,created_at`,
        [String(name).trim(), normalizedEmail, phone || null, department || null, year || null, hash, req.params.studentId]
      );
    } else {
      result = await pool.query(
        `UPDATE users SET name=$1,email=$2,phone=$3,department=$4,year=$5
         WHERE id=$6 AND role='student' RETURNING id,name,email,phone,department,year,created_at`,
        [String(name).trim(), normalizedEmail, phone || null, department || null, year || null, req.params.studentId]
      );
    }
    if (!result.rowCount) return res.status(404).json({ error: "Student account not found." });
    res.json({ student: result.rows[0], message: "Student account updated." });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email address is already used by another account." });
    next(err);
  }
});

router.get("/events/:eventId/participants", async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id,u.name,u.email,r.status FROM registrations r
       JOIN users u ON u.id=r.user_id
       WHERE r.event_id=$1 AND r.status IN ('registered','attended')
       ORDER BY u.name`, [req.params.eventId]
    );
    res.json({ participants: result.rows });
  } catch (err) { next(err); }
});

router.put("/events/:eventId/winners", async (req, res, next) => {
  const winnerIds = [req.body.firstUserId, req.body.secondUserId, req.body.thirdUserId];
  if (winnerIds.some(v => !Number.isInteger(Number(v)) || Number(v) <= 0) || new Set(winnerIds.map(Number)).size !== 3) {
    return res.status(400).json({ error: "Select three different registered students as winners." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const event = await client.query("SELECT id,title,event_date,venue FROM events WHERE id=$1", [req.params.eventId]);
    if (!event.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Event not found." }); }
    if (new Date(event.rows[0].event_date) > new Date()) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Winners can be announced only after the event date." }); }
    const participants = await client.query(
      `SELECT u.id,u.name,u.email FROM users u JOIN registrations r ON r.user_id=u.id
       WHERE r.event_id=$1 AND r.status IN ('registered','attended') AND u.id=ANY($2::int[])`,
      [req.params.eventId, winnerIds.map(Number)]
    );
    if (participants.rowCount !== 3) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Every selected winner must be registered for this event." }); }
    const byId = new Map(participants.rows.map(u => [Number(u.id), u]));
    const prizes = [3000, 2000, 1000];
    const winners = [];
    for (let i=0;i<3;i++) {
      const student = byId.get(Number(winnerIds[i]));
      const saved = await client.query(
        `INSERT INTO event_winners(event_id,position,winner_name,winner_user_id,winner_email,prize_amount)
         VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(event_id,position) DO UPDATE SET winner_name=EXCLUDED.winner_name,
         winner_user_id=EXCLUDED.winner_user_id,winner_email=EXCLUDED.winner_email,
         prize_amount=EXCLUDED.prize_amount,updated_at=NOW()
         RETURNING position,winner_name,winner_email,prize_amount`,
        [req.params.eventId, i+1, student.name, student.id, student.email, prizes[i]]
      );
      winners.push(saved.rows[0]);
    }
    await client.query("COMMIT");
    const emailResults = await Promise.all(winners.map(async w => {
      try {
        const sent = await sendMail({
          to: w.winner_email,
          subject: `Congratulations! You won ${event.rows[0].title}`,
          text: `Congratulations ${w.winner_name}!

You have been announced as position ${w.position} in ${event.rows[0].title}.
Prize: INR ${Number(w.prize_amount).toLocaleString("en-IN")}
Venue: ${event.rows[0].venue}

Thank you for participating.
EventHub — NIE College`
        });
        return { email: w.winner_email, sent };
      } catch (mailErr) { console.error("Winner email failed:", mailErr.message); return { email: w.winner_email, sent: false }; }
    }));
    res.json({ message: "Winners announced on EventHub.", winners, emailResults,
      emailsSent: emailResults.filter(x => x.sent).length,
      emailNotice: emailResults.every(x => x.sent) ? undefined : "Winners are published on the website, but one or more emails were not sent. Check SMTP settings and server logs." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    next(err);
  } finally { client.release(); }
});

module.exports = router;
