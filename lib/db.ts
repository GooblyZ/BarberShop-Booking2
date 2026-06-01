import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line no-var
  var _db: Database.Database | undefined;
}

function getDbPath(): string {
  // Vercel serverless: /var/task is read-only; /tmp is writable
  if (process.env.VERCEL) return '/tmp/appointments.db';
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'appointments.db');
}

export function getDb(): Database.Database {
  if (!global._db) {
    global._db = new Database(getDbPath());
    global._db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        open_hour INTEGER NOT NULL DEFAULT 9,
        close_hour INTEGER NOT NULL DEFAULT 18,
        working_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5]'
      );

      INSERT OR IGNORE INTO settings (id, open_hour, close_hour, working_days)
      VALUES (1, 9, 18, '[0,1,2,3,4,5]');

      CREATE TABLE IF NOT EXISTS days_off (
        date TEXT PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS blocked_ranges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        date TEXT
      );

      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        price INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);
    try { global._db.exec(`ALTER TABLE appointments ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'`); } catch {}
    try { global._db.exec(`ALTER TABLE appointments ADD COLUMN note TEXT`); } catch {}
    try { global._db.exec(`ALTER TABLE appointments ADD COLUMN token TEXT`); } catch {}
    try { global._db.exec(`ALTER TABLE appointments ADD COLUMN cancel_reason TEXT`); } catch {}
    try { global._db.exec(`ALTER TABLE settings ADD COLUMN admin_password_hash TEXT`); } catch {}

    // Backfill tokens
    const needsToken = global._db.prepare('SELECT id FROM appointments WHERE token IS NULL').all() as { id: number }[];
    if (needsToken.length > 0) {
      const setToken = global._db.prepare('UPDATE appointments SET token = ? WHERE id = ?');
      for (const row of needsToken) setToken.run(crypto.randomBytes(16).toString('hex'), row.id);
    }

    // Seed or migrate services
    const { cnt } = global._db.prepare('SELECT COUNT(*) as cnt FROM services').get() as { cnt: number };
    if (cnt === 0) {
      const ins = global._db.prepare('INSERT INTO services (name, duration, price, active, sort_order) VALUES (?, ?, ?, 1, ?)');
      ins.run('תספורת גברית', 30, 80,  0);
      ins.run('עיצוב זקן',    20, 50,  1);
      ins.run('תספורת + זקן', 45, 120, 2);
      ins.run('תספורת ילד',   25, 60,  3);
    } else {
      try {
        global._db.prepare("UPDATE services SET name = 'תספורת גברית', price = 80  WHERE name = 'תספורת'              AND price IS NULL").run();
        global._db.prepare("UPDATE services SET price = 50              WHERE name = 'עיצוב זקן'                       AND price IS NULL").run();
        global._db.prepare("UPDATE services SET price = 120, duration = 45 WHERE name = 'תספורת + זקן'                AND price IS NULL").run();
        global._db.prepare("UPDATE services SET price = 60              WHERE name IN ('תספורת ילד','תספורת נשים')     AND price IS NULL").run();
      } catch {}
    }
  }
  return global._db;
}
