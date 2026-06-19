require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const DEFAULT_FRONTEND_DIR = path.join(__dirname, '../frontend');
const DEFAULT_DATABASE_PATH = path.join(__dirname, '../database/tosm.db');
const DEFAULT_WEBGL_MODUL3_DIR = path.join(DEFAULT_FRONTEND_DIR, 'assets', 'animations', 'Modul3');

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureBootstrapUser(db, options = {}) {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) {
    return null;
  }

  const username = options.bootstrapUsername ?? process.env.BOOTSTRAP_USERNAME ?? 'admin';
  const email = (options.bootstrapEmail ?? process.env.BOOTSTRAP_EMAIL ?? 'admin@tosm.id').toLowerCase();
  const password = options.bootstrapPassword ?? process.env.BOOTSTRAP_PASSWORD ?? 'admin123';
  const role = options.bootstrapRole ?? process.env.BOOTSTRAP_ROLE ?? 'admin';
  const passwordHash = bcrypt.hashSync(password, 12);

  db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username.trim(), email, passwordHash, role);

  return { username, email, password, role };
}

function createApp(options = {}) {
  const app = express();
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const host = options.host ?? process.env.HOST;
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET ?? 'tosm-dev-secret';
  const frontendDir = options.frontendDir ?? process.env.FRONTEND_DIR ?? DEFAULT_FRONTEND_DIR;
  const databasePath = options.databasePath ?? process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
  const webglModul3Dir = options.webglModul3Dir ?? process.env.WEBGL_MODUL3_DIR ?? DEFAULT_WEBGL_MODUL3_DIR;

  // Database file lives outside the packaged app so the desktop build can write to it.
  ensureParentDir(databasePath);
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS kelas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nama         TEXT    NOT NULL,
      tingkat      TEXT    NOT NULL DEFAULT '',
      jurusan      TEXT    NOT NULL DEFAULT '',
      tahun_ajaran TEXT    NOT NULL DEFAULT '',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hasil_evaluasi (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id   INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
      modul_id   TEXT    NOT NULL,
      score      INTEGER NOT NULL,
      total      INTEGER NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS siswa (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nis           TEXT    NOT NULL UNIQUE,
      nama          TEXT    NOT NULL,
      jenis_kelamin TEXT    NOT NULL DEFAULT '',
      kelas_id      INTEGER REFERENCES kelas(id) ON DELETE SET NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      last_login    TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const bootstrapUser = ensureBootstrapUser(db, options);

  if (!options.silent) {
    console.log(`✓ Database connected (SQLite) -> ${databasePath}`);
    if (bootstrapUser) {
      console.log(`✓ Akun awal dibuat -> ${bootstrapUser.email} / ${bootstrapUser.password}`);
    }
  }

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(cors({ origin: (origin, cb) => cb(null, true) }));
  app.use((req, res, next) => {
    // Unity WebGL builds rely on cross-origin isolation for SharedArrayBuffer.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-cache');
    next();
  });

  // ── Serve frontend statically ───────────────────────────────────────────────
  app.use(express.static(frontendDir));

  // ── Serve WebGL modules ─────────────────────────────────────────────────────
  if (fs.existsSync(webglModul3Dir)) {
    app.use('/webgl/modul3', express.static(webglModul3Dir));
  }

  // ── Auth middleware ─────────────────────────────────────────────────────────
  function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    try {
      req.user = jwt.verify(auth.slice(7), jwtSecret);
      next();
    } catch {
      res.status(401).json({ message: 'Token tidak valid atau kadaluarsa' });
    }
  }

  // ── POST /api/auth/register ─────────────────────────────────────────────────
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username?.trim() || !email?.trim() || !password) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: 'Kata sandi minimal 8 karakter' });
      }

      const existing = db.prepare(
        'SELECT id FROM users WHERE email = ? OR username = ?'
      ).get(email.toLowerCase(), username.trim());

      if (existing) {
        return res.status(409).json({ message: 'Email atau username sudah terdaftar' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const result = db.prepare(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
      ).run(username.trim(), email.toLowerCase(), passwordHash);

      res.status(201).json({ message: 'Akun berhasil dibuat', userId: result.lastInsertRowid });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  });

  // ── POST /api/auth/login ────────────────────────────────────────────────────
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email?.trim() || !password) {
        return res.status(400).json({ message: 'Email dan kata sandi wajib diisi' });
      }

      const user = db.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).get(email.toLowerCase());

      if (!user) {
        return res.status(401).json({ message: 'Email atau kata sandi salah' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: 'Email atau kata sandi salah' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        jwtSecret,
        { expiresIn: '7d' }
      );

      db.prepare("UPDATE users SET last_login = datetime('now'), updated_at = datetime('now') WHERE id = ?")
        .run(user.id);

      res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  });

  // ── GET /api/me ─────────────────────────────────────────────────────────────
  app.get('/api/me', authMiddleware, (req, res) => {
    try {
      const user = db.prepare(
        'SELECT id, username, email, role, last_login, created_at FROM users WHERE id = ?'
      ).get(req.user.userId);

      if (!user) {
        return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
      }

      res.json(user);
    } catch (err) {
      console.error('Me error:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  });

  // ── PUT /api/me ──────────────────────────────────────────────────────────────
  app.put('/api/me', authMiddleware, async (req, res) => {
    try {
      const { username, current_password, new_password } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
      if (!user) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });

      // Require current password for any change
      if (!current_password) return res.status(400).json({ message: 'Password saat ini wajib diisi' });
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Password saat ini salah' });

      // Username change
      if (username?.trim() && username.trim() !== user.username) {
        const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), user.id);
        if (conflict) return res.status(409).json({ message: 'Username sudah digunakan' });
        db.prepare("UPDATE users SET username=?, updated_at=datetime('now') WHERE id=?")
          .run(username.trim(), user.id);
      }

      // Password change
      if (new_password) {
        if (new_password.length < 8) return res.status(400).json({ message: 'Password baru minimal 8 karakter' });
        const hash = await bcrypt.hash(new_password, 12);
        db.prepare("UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?")
          .run(hash, user.id);
      }

      const updated = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(user.id);
      res.json({ message: 'Profil berhasil diperbarui', user: updated });
    } catch (err) {
      console.error('Update me error:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  });

  // ── GET /api/kelas ─────────────────────────────────────────────────────────
  app.get('/api/kelas', authMiddleware, (req, res) => {
    const rows = db.prepare(`
      SELECT k.*, COUNT(s.id) AS jumlah_siswa
      FROM kelas k LEFT JOIN siswa s ON s.kelas_id = k.id
      GROUP BY k.id ORDER BY k.created_at DESC
    `).all();
    res.json(rows);
  });

  // ── POST /api/kelas ─────────────────────────────────────────────────────────
  app.post('/api/kelas', authMiddleware, (req, res) => {
    const { nama, tingkat, jurusan, tahun_ajaran } = req.body;
    if (!nama?.trim()) return res.status(400).json({ message: 'Nama kelas wajib diisi' });
    const result = db.prepare(
      'INSERT INTO kelas (nama, tingkat, jurusan, tahun_ajaran) VALUES (?, ?, ?, ?)'
    ).run(nama.trim(), tingkat?.trim() || '', jurusan?.trim() || '', tahun_ajaran?.trim() || '');
    res.status(201).json({ id: result.lastInsertRowid, message: 'Kelas berhasil ditambahkan' });
  });

  // ── PUT /api/kelas/:id ─────────────────────────────────────────────────────
  app.put('/api/kelas/:id', authMiddleware, (req, res) => {
    const { nama, tingkat, jurusan, tahun_ajaran } = req.body;
    if (!nama?.trim()) return res.status(400).json({ message: 'Nama kelas wajib diisi' });
    const result = db.prepare(
      "UPDATE kelas SET nama=?, tingkat=?, jurusan=?, tahun_ajaran=?, updated_at=datetime('now') WHERE id=?"
    ).run(nama.trim(), tingkat?.trim() || '', jurusan?.trim() || '', tahun_ajaran?.trim() || '', req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    res.json({ message: 'Kelas berhasil diperbarui' });
  });

  // ── DELETE /api/kelas/:id ─────────────────────────────────────────────────
  app.delete('/api/kelas/:id', authMiddleware, (req, res) => {
    const result = db.prepare('DELETE FROM kelas WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    res.json({ message: 'Kelas berhasil dihapus' });
  });

  // ── POST /api/evaluasi ─────────────────────────────────────────────────────
  app.post('/api/evaluasi', authMiddleware, (req, res) => {
    const { siswa_id, modul_id, score, total } = req.body;
    if (!siswa_id || !modul_id || score == null || !total)
      return res.status(400).json({ message: 'Data tidak lengkap' });
    const existing = db.prepare(
      'SELECT id FROM hasil_evaluasi WHERE siswa_id = ? AND modul_id = ?'
    ).get(Number(siswa_id), modul_id);
    if (existing) return res.status(409).json({ message: 'Siswa sudah mengerjakan ujian modul ini' });
    const result = db.prepare(
      'INSERT INTO hasil_evaluasi (siswa_id, modul_id, score, total) VALUES (?, ?, ?, ?)'
    ).run(Number(siswa_id), modul_id, score, total);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Hasil disimpan' });
  });

  // ── GET /api/evaluasi ─────────────────────────────────────────────────────
  app.get('/api/evaluasi', authMiddleware, (req, res) => {
    const rows = db.prepare(`
      SELECT h.*, s.nama AS siswa_nama, s.nis, k.nama AS kelas_nama
      FROM hasil_evaluasi h
      JOIN siswa s ON s.id = h.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      ORDER BY h.created_at DESC LIMIT 500
    `).all();
    res.json(rows);
  });

  // ── GET /api/siswa ─────────────────────────────────────────────────────────
  app.get('/api/siswa', authMiddleware, (req, res) => {
    const rows = db.prepare(`
      SELECT s.*, k.nama AS kelas_nama
      FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id
      ORDER BY s.created_at DESC
    `).all();
    res.json(rows);
  });

  // ── POST /api/siswa ─────────────────────────────────────────────────────────
  app.post('/api/siswa', authMiddleware, (req, res) => {
    const { nis, nama, jenis_kelamin, kelas_id } = req.body;
    if (!nis?.trim() || !nama?.trim()) return res.status(400).json({ message: 'NIS dan nama wajib diisi' });
    const existing = db.prepare('SELECT id FROM siswa WHERE nis = ?').get(nis.trim());
    if (existing) return res.status(409).json({ message: 'NIS sudah terdaftar' });
    const result = db.prepare(
      'INSERT INTO siswa (nis, nama, jenis_kelamin, kelas_id) VALUES (?, ?, ?, ?)'
    ).run(nis.trim(), nama.trim(), jenis_kelamin?.trim() || '', kelas_id || null);
    res.status(201).json({ id: result.lastInsertRowid, message: 'Siswa berhasil ditambahkan' });
  });

  // ── PUT /api/siswa/:id ─────────────────────────────────────────────────────
  app.put('/api/siswa/:id', authMiddleware, (req, res) => {
    const { nis, nama, jenis_kelamin, kelas_id } = req.body;
    if (!nis?.trim() || !nama?.trim()) return res.status(400).json({ message: 'NIS dan nama wajib diisi' });
    const conflict = db.prepare('SELECT id FROM siswa WHERE nis = ? AND id != ?').get(nis.trim(), req.params.id);
    if (conflict) return res.status(409).json({ message: 'NIS sudah digunakan siswa lain' });
    const result = db.prepare(
      "UPDATE siswa SET nis=?, nama=?, jenis_kelamin=?, kelas_id=?, updated_at=datetime('now') WHERE id=?"
    ).run(nis.trim(), nama.trim(), jenis_kelamin?.trim() || '', kelas_id || null, req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    res.json({ message: 'Siswa berhasil diperbarui' });
  });

  // ── DELETE /api/siswa/:id ─────────────────────────────────────────────────
  app.delete('/api/siswa/:id', authMiddleware, (req, res) => {
    const result = db.prepare('DELETE FROM siswa WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    res.json({ message: 'Siswa berhasil dihapus' });
  });

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', time: new Date(), databasePath, frontendDir, webglModul3Dir });
  });

  return { app, port, host, db, frontendDir, databasePath, webglModul3Dir, bootstrapUser };
}

function startServer(options = {}) {
  const context = createApp(options);

  return new Promise((resolve, reject) => {
    const server = context.app.listen(context.port, context.host, () => {
      if (!options.silent) {
        console.log(`\n🚀 Server berjalan di http://localhost:${context.port}\n`);
      }

      resolve({ ...context, server });
    });

    server.on('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Gagal menjalankan server:', error);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
