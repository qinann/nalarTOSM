require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tosm-dev-secret';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: (origin, cb) => cb(null, true) }));

// ── Serve frontend statically ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Database pool ─────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'tosm_db',
  waitForConnections: true,
  connectionLimit:  10,
  charset:          'utf8mb4',
});

pool.getConnection()
  .then(conn => { console.log('✓ Database connected'); conn.release(); })
  .catch(err  => console.error('✗ Database error:', err.message));

// ── Auth middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid atau kadaluarsa' });
  }
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username?.trim() || !email?.trim() || !password)
      return res.status(400).json({ message: 'Semua field wajib diisi' });

    if (password.length < 8)
      return res.status(400).json({ message: 'Kata sandi minimal 8 karakter' });

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email.toLowerCase(), username.trim()]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: 'Email atau username sudah terdaftar' });

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username.trim(), email.toLowerCase(), passwordHash]
    );

    res.status(201).json({ message: 'Akun berhasil dibuat', userId: result.insertId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password)
      return res.status(400).json({ message: 'Email dan kata sandi wajib diisi' });

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email.toLowerCase()]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: 'Email atau kata sandi salah' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ message: 'Email atau kata sandi salah' });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// ── GET /api/me ───────────────────────────────────────────────────────────────
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, last_login, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

app.listen(PORT, () => console.log(`\n🚀 Server berjalan di http://localhost:${PORT}\n`));
