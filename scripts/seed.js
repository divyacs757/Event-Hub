require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  try {
    const name = process.env.ADMIN_NAME || "EventHub Administrator";
    const email = (process.env.ADMIN_EMAIL || "admin@nie.ac.in").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123!";
    if (password.length < 8) throw new Error("ADMIN_PASSWORD must contain at least 8 characters.");

    const hash = await bcrypt.hash(password, 12);
    const adminResult = await pool.query(
      `INSERT INTO users(name,email,password_hash,role)
       VALUES($1,$2,$3,'admin')
       ON CONFLICT(email) DO UPDATE SET
         name=EXCLUDED.name, password_hash=EXCLUDED.password_hash, role='admin'
       RETURNING id`,
      [name, email, hash]
    );
    const adminId = adminResult.rows[0].id;

    const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM events");
    if (countResult.rows[0].count === 0) {
      const defaults = [
        ["EventHub TechFest 2026", "A campus technology festival featuring project showcases, coding challenges, emerging technology talks and hands-on demonstrations.", "Technical", "Main Auditorium & Computer Science Labs", 14, 10, 250, 0, 5000, "Free registration. Bring your college ID and laptop for hands-on rounds."],
        ["CodeSprint — 6 Hour Hackathon", "Build a practical software solution in teams. Present your prototype to a panel of mentors and judges.", "Hackathon", "Innovation Centre", 21, 16, 120, 50, 10000, "Registration fee ₹50 per participant. Team size: 2–4. Payment instructions will be shared by the event coordinator."],
        ["Sanskriti Cultural Evening", "Celebrate campus talent with music, dance, theatre, fashion and cultural performances.", "Cultural", "Open Air Theatre", 28, 24, 400, 0, 7000, "Free entry. Performers must complete the audition and slot confirmation."],
        ["RoboRally — Robotics Challenge", "Design, build and test a robot through obstacle, speed and precision challenges.", "Robotics", "Mechanical Engineering Workshop", 35, 31, 80, 100, 12000, "₹100 per team. Teams may include up to 4 students. Safety rules apply."],
        ["FrameFest — Photography Contest", "Capture campus life through a themed photography contest. Submit original photographs for jury evaluation.", "Arts & Media", "Seminar Hall", 42, 38, 150, 0, 3000, "Free registration. Submit one original photograph per participant in JPG or PNG format."]
      ];
      for (const e of defaults) {
        await pool.query(
          `INSERT INTO events(title,description,category,venue,event_date,registration_deadline,capacity,registration_fee,prize_money,payment_instructions,created_by)
           VALUES($1,$2,$3,$4, date_trunc('day', NOW()) + make_interval(days => $5::int) + interval '10 hours',
             date_trunc('day', NOW()) + make_interval(days => $6::int) + interval '23 hours', $7,$8,$9,$10,$11)`,
          [...e, adminId]
        );
      }
      console.log("Five sample events created.");
    } else {
      console.log(`Keeping existing events (${countResult.rows[0].count}); no sample events inserted.`);
    }
    console.log(`Admin account ready: ${email}`);
  } catch (err) {
    console.error("Database seeding failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
main();
