-- JOB PORTAL DATABASE SCHEMA (SQLite)
-- Tables: users, jobs, applications, sessions
-- Relationships:  users 1---* jobs (recruiter posts jobs)
--                 users 1---* applications *---1 jobs (user applies to job)
--                 users 1---* sessions (login sessions)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                 -- scrypt hash, never plain text
  role          TEXT NOT NULL CHECK (role IN ('user','recruiter','admin')),
  location      TEXT DEFAULT '',
  skills        TEXT DEFAULT '',
  bio           TEXT DEFAULT '',
  company       TEXT DEFAULT '',
  created_at    TEXT DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  company      TEXT DEFAULT '',
  location     TEXT DEFAULT '',
  type         TEXT DEFAULT 'Full-time' CHECK (type IN ('Full-time','Part-time','Internship','Contract')),
  salary       TEXT DEFAULT '',
  skills       TEXT DEFAULT '',
  description  TEXT NOT NULL,
  deadline     TEXT DEFAULT '',
  is_open      INTEGER DEFAULT 1,              -- 1 = open, 0 = closed
  created_at   TEXT DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_letter TEXT DEFAULT '',
  status       TEXT DEFAULT 'Applied' CHECK (status IN ('Applied','Shortlisted','Interview','Hired','Rejected')),
  applied_on   TEXT DEFAULT (date('now')),
  UNIQUE (job_id, user_id)                     -- a user can apply to a job only once
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);
