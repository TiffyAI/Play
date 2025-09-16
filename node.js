// server.js
import express from "express";
import bodyParser from "body-parser";
import { Pool } from "pg";
import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// ---------- Database setup ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render gives you this
  ssl: { rejectUnauthorized: false },
});

// Ensure table exists
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS online_users (
      id UUID PRIMARY KEY,
      name TEXT,
      last_seen TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id UUID,
      subscription JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};
initDb();

// ---------- Web Push setup ----------
webpush.setVapidDetails(
  "mailto:you@example.com", // change later
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ---------- Routes ----------

// Heartbeat from client
app.post("/heartbeat", async (req, res) => {
  const { id, name } = req.body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  await pool.query(
    `
      INSERT INTO online_users (id, name, last_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, last_seen = NOW()
    `,
    [id, name || "Anonymous"]
  );

  res.json({ ok: true });
});

// Count online users (last seen < 1 minute)
app.get("/online/count", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT COUNT(*) FROM online_users WHERE last_seen > NOW() - INTERVAL '1 minute'"
  );
  res.json({ online: parseInt(rows[0].count, 10) });
});

// List online users (for Tiffy index later)
app.get("/online/list", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT name FROM online_users WHERE last_seen > NOW() - INTERVAL '1 minute'"
  );
  res.json({ users: rows.map((r) => r.name) });
});

// Save push subscription
app.post("/subscribe", async (req, res) => {
  const { id, subscription } = req.body;
  if (!id || !subscription) return res.status(400).json({ error: "Missing fields" });

  await pool.query(
    "INSERT INTO subscriptions (user_id, subscription) VALUES ($1, $2)",
    [id, subscription]
  );

  res.json({ ok: true });
});

// Send a notification (triggered manually or cron job)
app.post("/notify", async (req, res) => {
  const { title, body, icon, sound } = req.body;

  const { rows } = await pool.query("SELECT subscription FROM subscriptions");
  const payload = JSON.stringify({
    title: title || "TiffyAI",
    body: body || "🔹 Claim your blue key now!",
    icon: icon || "/KeysB.png",
    badge: "/KeysB.png",
    data: { url: "/" },
    sound: sound || "/notification.wav",
  });

  let success = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      success++;
    } catch (err) {
      console.error("Push error:", err);
    }
  }

  res.json({ sent: success, total: rows.length });
});

// ---------- Start ----------
app.listen(port, () => {
  console.log(`TiffyAI backend running on port ${port}`);
});
