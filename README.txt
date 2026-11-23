JOB PORTAL (admin / recruiter / user) - Frontend + Backend + SQLite Database
No npm install, no MongoDB, no .env. Needs only Node.js 22.5 or newer (check: node -v).

HOW TO RUN (Windows)
  1. Extract the zip. Open Command Prompt INSIDE the folder that contains server.js:
        cd C:\Users\HP\Downloads\job-portal\job-portal
        node server.js
  2. Open http://localhost:3000     (an "ExperimentalWarning: SQLite" line is normal)

DEMO LOGINS
  Admin      admin@jobportal.com  / admin123
  Recruiters hr@technova.com , hr@securenet.com  / hr12345
  Users      user@jobportal.com , riya@mail.com , aman@mail.com  / user123

LANGUAGES USED
  HTML ........ page structure (public/**/*.html - one page per module)
  CSS ......... styling, light + dark mode (public/css/style.css)
  JavaScript .. frontend logic (public/js/common.js + script in each page) and backend (server.js, Node.js)
  SQL ......... database design (schema.sql) and all queries inside server.js (SQLite)

PROJECT STRUCTURE (same modules as the original project)
  server.js                  Backend: REST API, login/sessions, role checks, SQL queries
  schema.sql                 Database tables, keys, constraints
  jobportal.db               SQLite database (auto-created on first run with sample data)
  public/
    index.html               Home page (links to all modules)
    css/style.css            Shared CSS for all pages
    js/common.js             Shared JavaScript: API calls, login/register, navigation, page guard
    user/                    USER MODULE
      register.html  login.html  jobs.html (search/filter/pagination/apply)
      applications.html (track/withdraw)  profile.html
    recruiter/               RECRUITER MODULE
      register.html  login.html  add-job.html (also edit)  manage-jobs.html
      applications.html (shortlist/interview/hire/reject)  profile.html
    admin/                   ADMIN MODULE
      login.html  stats.html  manage-users.html  all-jobs.html  database.html  profile.html

DATABASE (SQLite) - 4 tables
  users(id, name, email UNIQUE, password_hash, role, location, skills, bio, company, created_at)
  jobs(id, recruiter_id -> users, title, company, location, type, salary, skills, description, deadline, is_open, created_at)
  applications(id, job_id -> jobs, user_id -> users, cover_letter, status, applied_on, UNIQUE(job_id,user_id))
  sessions(token, user_id -> users, created_at)
  Deleting a user/job removes related rows automatically (ON DELETE CASCADE).
  Reset: stop server, delete jobportal.db, start again. Admin > Database page shows all tables live.

SECURITY (viva points)
  Salted scrypt password hashing; HttpOnly cookie sessions stored in the database; role checked on the
  server for every API route; prepared SQL statements (no SQL injection); output escaped (no XSS);
  input validated and length-limited.
