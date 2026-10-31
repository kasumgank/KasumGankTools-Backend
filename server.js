require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET to a random value of at least 32 characters.");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Create a PostgreSQL database and set it in Render.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
});

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",").map(v => v.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

function makeToken(user) {
  return jwt.sign({ id: String(user.id), role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (!token) throw new Error("missing");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Silakan login kembali." });
  }
}
function ownerOnly(req, res, next) {
  if (req.user.role !== "owner") return res.status(403).json({ error: "Khusus owner." });
  next();
}

app.get("/", (_req, res) => res.json({ name: "KasumGangTools API", status: "online" }));
app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: "connected" }); }
  catch { res.status(503).json({ ok: false, database: "unavailable" }); }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9_]{3,40}$/.test(username)) return res.status(400).json({ error: "Username 3-40 karakter; gunakan huruf, angka, atau underscore." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Email tidak valid." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password harus 8-72 karakter." });
    const hash = await bcrypt.hash(password, 12);
    const role = process.env.OWNER_EMAIL && email === process.env.OWNER_EMAIL.toLowerCase() ? "owner" : "member";
    const result = await pool.query(
      "INSERT INTO users(username,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,username,email,role",
      [username, email, hash, role]
    );
    const user = result.rows[0];
    res.status(201).json({ token: makeToken(user), user });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Username atau email sudah digunakan." });
    console.error(e); res.status(500).json({ error: "Pendaftaran gagal." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const result = await pool.query("SELECT id,username,email,password_hash,role FROM users WHERE email=$1", [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Email atau password salah." });
    delete user.password_hash;
    res.json({ token: makeToken(user), user });
  } catch (e) { console.error(e); res.status(500).json({ error: "Login gagal." }); }
});

app.get("/api/me", auth, async (req, res) => {
  const result = await pool.query("SELECT id,username,email,role,created_at FROM users WHERE id=$1", [req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Akun tidak ditemukan." });
  res.json({ user: result.rows[0] });
});

app.get("/api/bots/public", async (_req, res) => {
  const result = await pool.query(
    "SELECT b.id,b.display_name,b.status,u.username FROM bots b JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC LIMIT 100"
  );
  res.json({ bots: result.rows });
});

app.get("/api/bots", auth, async (req, res) => {
  const result = await pool.query("SELECT id,display_name,status,created_at FROM bots WHERE user_id=$1 ORDER BY created_at DESC", [req.user.id]);
  res.json({ bots: result.rows });
});

// Placeholder only: WhatsApp connection/pairing is intentionally not enabled in this starter.
app.post("/api/bots", auth, async (req, res) => {
  const name = String(req.body.displayName || "").trim();
  if (!name || name.length > 60) return res.status(400).json({ error: "Nama bot wajib diisi (maksimal 60 karakter)." });
  const result = await pool.query(
    "INSERT INTO bots(user_id,display_name,status) VALUES($1,$2,'offline') RETURNING id,display_name,status,created_at",
    [req.user.id, name]
  );
  res.status(201).json({ bot: result.rows[0], note: "Bot dibuat sebagai data saja; koneksi WhatsApp belum diaktifkan." });
});

app.get("/api/owner/stats", auth, ownerOnly, async (_req, res) => {
  const [users, bots] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM users"),
    pool.query("SELECT COUNT(*)::int AS total FROM bots")
  ]);
  res.json({ users: users.rows[0].total, bots: bots.rows[0].total });
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: "Terjadi kesalahan server." });
});

app.listen(PORT, () => console.log(`KasumGangTools API listening on ${PORT}`));
