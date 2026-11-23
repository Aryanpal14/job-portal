/* =====================================================================
   JOB PORTAL - BACKEND  (Node.js built-ins only, no npm packages)
   - HTTP server .......... node:http
   - Database ............. SQLite via node:sqlite  (file: jobportal.db, schema: schema.sql)
   - Password hashing ..... crypto.scrypt (salted)
   - Login ................ random session token stored in `sessions` table + HttpOnly cookie
   - Roles ................ user / recruiter / admin (checked on the server for every route)
   ===================================================================== */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const PORT = process.env.PORT || 3000;

/* ---------- 1. DATABASE SETUP ---------- */
const db = new DatabaseSync(path.join(__dirname, 'jobportal.db'));
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));   // create tables
const all = (sql, ...p) => db.prepare(sql).all(...p);                   // many rows
const one = (sql, ...p) => db.prepare(sql).get(...p);                   // one row
const run = (sql, ...p) => db.prepare(sql).run(...p);                   // insert/update/delete

/* ---------- 2. PASSWORD HELPERS ---------- */
const hash = (pw, salt = crypto.randomBytes(8).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const verify = (pw, h) => { const a = Buffer.from(hash(pw, h.split(':')[0])), b = Buffer.from(h); return a.length == b.length && crypto.timingSafeEqual(a, b); };

/* ---------- 3. SAMPLE DATA (inserted only when the database is empty) ---------- */
if (!one('SELECT id FROM users LIMIT 1')) {
  const U = (n, e, pw, r, loc, sk, bio, co) => run('INSERT INTO users(name,email,password_hash,role,location,skills,bio,company) VALUES(?,?,?,?,?,?,?,?)', n, e, hash(pw), r, loc, sk, bio, co);
  U('Admin', 'admin@jobportal.com', 'admin123', 'admin', '', '', '', '');
  U('TechNova HR', 'hr@technova.com', 'hr12345', 'recruiter', 'Kanpur', '', 'Hiring for engineering roles', 'TechNova Pvt Ltd');
  U('SecureNet HR', 'hr@securenet.com', 'hr12345', 'recruiter', 'Lucknow', '', '', 'SecureNet Solutions');
  U('Aryan Pal', 'user@jobportal.com', 'user123', 'user', 'Kanpur', 'python, html, css, javascript, sql, security', 'B.Tech CSE (Cyber Security)', '');
  U('Riya Sharma', 'riya@mail.com', 'user123', 'user', 'Lucknow', 'java, sql, spring', 'Final-year CSE student', '');
  U('Aman Verma', 'aman@mail.com', 'user123', 'user', 'Noida', 'php, mysql, html, css', 'Web developer fresher', '');
  const J = (r, t, co, l, ty, s, sk, d, dl) => run('INSERT INTO jobs(recruiter_id,title,company,location,type,salary,skills,description,deadline) VALUES(?,?,?,?,?,?,?,?,?)', r, t, co, l, ty, s, sk, d, dl);
  J(2, 'Junior Web Developer', 'TechNova Pvt Ltd', 'Kanpur', 'Full-time', '3-5 LPA', 'html, css, javascript, sql', 'Build and maintain company websites.', '2026-12-31');
  J(2, 'Backend Developer', 'TechNova Pvt Ltd', 'Noida', 'Full-time', '5-8 LPA', 'node, sql, api', 'Develop REST APIs and database models.', '2026-12-15');
  J(2, 'Software Testing Intern', 'TechNova Pvt Ltd', 'Remote', 'Internship', '10k/month', 'testing, python', 'Write and run test cases.', '2026-11-30');
  J(3, 'Security Analyst Intern', 'SecureNet Solutions', 'Lucknow', 'Internship', '15k/month', 'python, security, linux', 'Monitor logs and assist in incident response.', '2026-11-30');
  J(3, 'Network Engineer', 'SecureNet Solutions', 'Lucknow', 'Full-time', '4-6 LPA', 'networking, linux, security', 'Maintain company network and firewalls.', '2026-12-20');
  J(3, 'Data Entry Operator', 'SecureNet Solutions', 'Kanpur', 'Part-time', '8k/month', 'excel, typing', 'Maintain records in spreadsheets.', '2026-11-25');
  const A = (j, u, c, s) => run('INSERT INTO applications(job_id,user_id,cover_letter,status) VALUES(?,?,?,?)', j, u, c, s);
  A(1, 4, 'I love building websites.', 'Shortlisted'); A(4, 4, 'Interested in cyber security.', 'Applied');
  A(1, 6, 'Fresher with PHP and HTML skills.', 'Applied'); A(2, 5, 'Strong in SQL.', 'Interview');
}

/* ---------- 4. SQL FRAGMENTS (column aliases keep the API field names simple) ---------- */
const USER_COLS = 'id,name,email,role,location,skills,bio,company';
const JOB_COLS = 'id,recruiter_id AS rid,title,company,location,type,salary,skills,description AS "desc",deadline,is_open AS "open",created_at AS created';
const S = (v, n = 200) => String(v ?? '').trim().slice(0, n);               // sanitize text input
const TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract'], STATUS = ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
const today = () => new Date().toISOString().slice(0, 10);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const readBody = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); });

/* ---------- 5. HTTP SERVER + ROUTES ---------- */
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname, m = req.method;
  const send = (c, o, h = {}) => { res.writeHead(c, { 'Content-Type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
  try {
    // 5.1 Static frontend files (public/ folder)
    if (!p.startsWith('/api/')) {
      const root = path.join(__dirname, 'public'), fp = path.join(root, path.normalize(p == '/' ? 'index.html' : p.slice(1)));
      if (!fp.startsWith(root) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' }); return res.end(fs.readFileSync(fp));
    }
    const b = (m == 'POST' || m == 'PUT') ? await readBody(req) : {};

    // 5.2 Who is logged in? (cookie -> sessions table -> users table)
    const ck = (req.headers.cookie || '').match(/sid=(\w+)/);
    const me = ck && one(`SELECT ${USER_COLS} FROM users WHERE id=(SELECT user_id FROM sessions WHERE token=?)`, ck[1]);
    const need = (...roles) => {                                            // role-based access control
      if (!me) { send(401, { error: 'Please log in first' }); return false; }
      if (roles.length && !roles.includes(me.role)) { send(403, { error: 'You are not allowed to do this' }); return false; }
      return true;
    };
    const login = id => {                                                   // create session + cookie
      const t = crypto.randomBytes(24).toString('hex'); run('INSERT INTO sessions(token,user_id) VALUES(?,?)', t, id);
      send(200, { user: one(`SELECT ${USER_COLS} FROM users WHERE id=?`, id) }, { 'Set-Cookie': `sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800` });
    };
    let x;

    // ----- AUTH -----
    if (p == '/api/register' && m == 'POST') {
      const e = S(b.email).toLowerCase(), n = S(b.name, 60), r = b.role == 'recruiter' ? 'recruiter' : 'user';
      if (!n || !/^\S+@\S+\.\S+$/.test(e)) return send(400, { error: 'Enter your name and a valid email' });
      if (S(b.password, 100).length < 6) return send(400, { error: 'Password must be at least 6 characters' });
      if (one('SELECT id FROM users WHERE email=?', e)) return send(400, { error: 'Email already registered' });
      const id = run('INSERT INTO users(name,email,password_hash,role,company) VALUES(?,?,?,?,?)', n, e, hash(b.password), r, r == 'recruiter' ? (S(b.company, 80) || n) : '').lastInsertRowid;
      return login(id);
    }
    if (p == '/api/login' && m == 'POST') {
      const a = one('SELECT id,password_hash FROM users WHERE email=?', S(b.email).toLowerCase());
      if (!a || !verify(String(b.password || ''), a.password_hash)) return send(400, { error: 'Invalid email or password' });
      return login(a.id);
    }
    if (p == '/api/logout' && m == 'POST') { if (ck) run('DELETE FROM sessions WHERE token=?', ck[1]); return send(200, { ok: 1 }, { 'Set-Cookie': 'sid=; Path=/; Max-Age=0' }); }
    if (p == '/api/me' && m == 'GET') return send(200, { user: me || null });
    if (p == '/api/me' && m == 'PUT') {
      if (!need()) return;
      run('UPDATE users SET name=?,location=?,skills=?,bio=?,company=? WHERE id=?', S(b.name, 60) || me.name, S(b.location, 80), S(b.skills, 300), S(b.bio, 500), me.role == 'recruiter' ? (S(b.company, 80) || me.company) : me.company, me.id);
      return send(200, { user: one(`SELECT ${USER_COLS} FROM users WHERE id=?`, me.id) });
    }

    // ----- JOBS -----
    if (p == '/api/jobs' && m == 'GET') {                                   // search + filter + pagination
      if (!need()) return;
      const q = '%' + S(u.searchParams.get('q')).toLowerCase() + '%', t = S(u.searchParams.get('type')), pg = Math.max(1, +u.searchParams.get('page') || 1), lim = 5;
      const where = `is_open=1 AND (?='' OR type=?) AND lower(title||company||location||skills) LIKE ?`;
      const total = one(`SELECT COUNT(*) AS n FROM jobs WHERE ${where}`, t, t, q).n;
      const jobs = all(`SELECT ${JOB_COLS}, (SELECT COUNT(*) FROM applications a WHERE a.job_id=jobs.id AND a.user_id=?) AS applied FROM jobs WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, me.id, t, t, q, lim, (pg - 1) * lim);
      return send(200, { total, pages: Math.max(1, Math.ceil(total / lim)), jobs: jobs.map(j => ({ ...j, applied: !!j.applied })) });
    }
    if (p == '/api/jobs' && m == 'POST') {
      if (!need('recruiter')) return;
      const t = S(b.title, 100), d = S(b.desc, 2000); if (!t || !d) return send(400, { error: 'Title and description are required' });
      const id = run('INSERT INTO jobs(recruiter_id,title,company,location,type,salary,skills,description,deadline) VALUES(?,?,?,?,?,?,?,?,?)', me.id, t, me.company, S(b.location, 80), TYPES.includes(b.type) ? b.type : 'Full-time', S(b.salary, 60), S(b.skills, 300), d, S(b.deadline, 10)).lastInsertRowid;
      return send(200, { job: one(`SELECT ${JOB_COLS} FROM jobs WHERE id=?`, id) });
    }
    if (p == '/api/my-jobs' && m == 'GET') { if (!need('recruiter')) return; return send(200, { jobs: all(`SELECT ${JOB_COLS},(SELECT COUNT(*) FROM applications WHERE job_id=jobs.id) AS count FROM jobs WHERE recruiter_id=? ORDER BY id DESC`, me.id) }); }
    if (p == '/api/all-jobs' && m == 'GET') { if (!need('admin')) return; return send(200, { jobs: all(`SELECT ${JOB_COLS} FROM jobs ORDER BY id DESC`) }); }
    if (x = p.match(/^\/api\/jobs\/(\d+)$/)) {
      if (!need()) return;
      const j = one(`SELECT ${JOB_COLS} FROM jobs WHERE id=?`, x[1]); if (!j) return send(404, { error: 'Job not found' });
      if (m == 'GET') return send(200, { job: j });
      if (me.role != 'admin' && j.rid != me.id) return send(403, { error: 'Not your job' });   // only owner or admin
      if (m == 'PUT') {
        run('UPDATE jobs SET title=?,location=?,type=?,salary=?,skills=?,description=?,deadline=?,is_open=? WHERE id=?', S(b.title ?? j.title, 100), S(b.location ?? j.location, 80), TYPES.includes(b.type) ? b.type : j.type, S(b.salary ?? j.salary, 60), S(b.skills ?? j.skills, 300), S(b.desc ?? j.desc, 2000), S(b.deadline ?? j.deadline, 10), b.open === undefined ? j.open : (b.open ? 1 : 0), j.id);
        return send(200, { job: one(`SELECT ${JOB_COLS} FROM jobs WHERE id=?`, j.id) });
      }
      if (m == 'DELETE') { run('DELETE FROM jobs WHERE id=?', j.id); return send(200, { ok: 1 }); }   // applications removed by ON DELETE CASCADE
    }

    // ----- APPLICATIONS -----
    if (p == '/api/apply' && m == 'POST') {
      if (!need('user')) return;
      const j = one('SELECT id,deadline FROM jobs WHERE id=? AND is_open=1', +b.jobId); if (!j) return send(404, { error: 'Job not available' });
      if (j.deadline && j.deadline < today()) return send(400, { error: 'Application deadline has passed' });
      if (one('SELECT id FROM applications WHERE job_id=? AND user_id=?', j.id, me.id)) return send(400, { error: 'You already applied to this job' });
      run('INSERT INTO applications(job_id,user_id,cover_letter) VALUES(?,?,?)', j.id, me.id, S(b.letter, 1000)); return send(200, { ok: 1 });
    }
    if (p == '/api/my-applications' && m == 'GET') {
      if (!need('user')) return;
      const r = all('SELECT a.id,a.status,a.applied_on AS date,j.title,j.company FROM applications a LEFT JOIN jobs j ON j.id=a.job_id WHERE a.user_id=? ORDER BY a.id DESC', me.id);
      return send(200, { apps: r.map(a => ({ id: a.id, status: a.status, date: a.date, job: { title: a.title, company: a.company } })) });
    }
    if (p == '/api/recruiter-applications' && m == 'GET') {
      if (!need('recruiter')) return;
      const r = all('SELECT a.id,a.status,a.cover_letter AS letter,a.applied_on AS date,j.title,u.name,u.email,u.skills,u.location FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.user_id WHERE j.recruiter_id=? ORDER BY a.id DESC', me.id);
      return send(200, { apps: r.map(a => ({ ...a, job: { title: a.title } })) });
    }
    if (x = p.match(/^\/api\/applications\/(\d+)$/)) {
      if (!need()) return;
      const a = one('SELECT a.id,a.user_id,j.recruiter_id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=?', x[1]); if (!a) return send(404, { error: 'Not found' });
      if (m == 'PUT') { if (me.role != 'recruiter' || a.recruiter_id != me.id) return send(403, { error: 'Not allowed' }); if (!STATUS.includes(b.status)) return send(400, { error: 'Bad status' }); run('UPDATE applications SET status=? WHERE id=?', b.status, a.id); return send(200, { ok: 1 }); }
      if (m == 'DELETE') { if (me.role != 'user' || a.user_id != me.id) return send(403, { error: 'Not allowed' }); run('DELETE FROM applications WHERE id=?', a.id); return send(200, { ok: 1 }); }
    }

    // ----- ADMIN -----
    if (p == '/api/admin/users' && m == 'GET') { if (!need('admin')) return; return send(200, { users: all(`SELECT ${USER_COLS} FROM users ORDER BY id`) }); }
    if (x = p.match(/^\/api\/admin\/users\/(\d+)$/)) {
      if (!need('admin')) return;
      const t = one('SELECT id FROM users WHERE id=?', x[1]); if (!t) return send(404, { error: 'User not found' });
      if (t.id == me.id) return send(400, { error: 'You cannot change your own account here' });
      if (m == 'PUT') { if (!['user', 'recruiter', 'admin'].includes(b.role)) return send(400, { error: 'Bad role' }); run('UPDATE users SET role=? WHERE id=?', b.role, t.id); return send(200, { ok: 1 }); }
      if (m == 'DELETE') { run('DELETE FROM users WHERE id=?', t.id); return send(200, { ok: 1 }); }   // cascades to their jobs, applications, sessions
    }
    if (p == '/api/admin/stats' && m == 'GET') {
      if (!need('admin')) return;
      const n = (sql) => one(sql).n, st = Object.fromEntries(STATUS.map(s => [s, one('SELECT COUNT(*) AS n FROM applications WHERE status=?', s).n]));
      return send(200, { users: n("SELECT COUNT(*) n FROM users WHERE role='user'"), recruiters: n("SELECT COUNT(*) n FROM users WHERE role='recruiter'"), admins: n("SELECT COUNT(*) n FROM users WHERE role='admin'"), jobs: n('SELECT COUNT(*) n FROM jobs'), openJobs: n('SELECT COUNT(*) n FROM jobs WHERE is_open=1'), apps: n('SELECT COUNT(*) n FROM applications'), status: st });
    }
    // Database viewer for demonstration (admin only): shows schema + every table
    if (p == '/api/admin/db' && m == 'GET') {
      if (!need('admin')) return;
      const tables = {}; for (const t of ['users', 'jobs', 'applications', 'sessions']) tables[t] = all(`SELECT * FROM ${t} LIMIT 100`).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (k == 'password_hash' || k == 'token') ? '(hidden)' : v])));
      return send(200, { schema: fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'), tables });
    }
    send(404, { error: 'Not found' });
  } catch (e) { console.error(e); send(500, { error: 'Server error' }); }
}).listen(PORT, () => console.log(`Job Portal running at http://localhost:${PORT}`));
