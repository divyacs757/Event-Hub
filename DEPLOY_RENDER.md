# EventHub — guided public deployment (Render)

This project is a full-stack Node.js/Express app with PostgreSQL. Deploy it as a **Render Web Service**, not a Static Site.

## Before you start

- A GitHub account and a Render account.
- The project root must contain `package.json`, `server.js`, `db/`, `scripts/`, `src/`, and `public/`.
- Do not upload `.env`, database passwords, SMTP passwords, or JWT secrets to GitHub.

## 1. Put the project on GitHub

1. Extract this ZIP.
2. Open the `EventHub_Fresh` folder in VS Code (the folder containing `package.json`).
3. In the VS Code terminal, run:

   ```powershell
   git init
   git branch -M main
   git add .
   git commit -m "Prepare EventHub for cloud deployment"
   ```

4. Create a new **private** repository on GitHub named `EventHub` (or another name). Do not initialize it with a README, license, or .gitignore.
5. Copy the repository's HTTPS URL, then run (replace the example URL):

   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/EventHub.git
   git push -u origin main
   ```

If Git says a remote already exists, use `git remote set-url origin https://github.com/YOUR-USERNAME/EventHub.git` instead.

## 2. Create the PostgreSQL database

1. Sign in at https://dashboard.render.com/.
2. Choose **New + → PostgreSQL**.
3. Name it `eventhub-db`. Choose a region close to your students (for example, Singapore if available).
4. Select a plan. A free database is only for a short demo; Render documents that free Postgres expires after 30 days. For a real college service, choose a paid database and enable backups.
5. Create the database and wait until it is available.
6. On the database page, copy its **External Database URL** for the one-time schema setup from your own computer. Keep it private. Do not paste it into chat or GitHub.

## 3. Create the public website service

1. In Render choose **New + → Web Service**.
2. Connect GitHub and select your `EventHub` repository.
3. Set:
   - Branch: `main`
   - Root Directory: leave blank (if `package.json` is at repository root)
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Choose a plan. Free is for testing only; it sleeps after inactivity and cannot keep uploaded files on a persistent disk.
5. Create the service, but add the environment variables below before relying on the first deploy. If the first build fails because required variables are missing, add them and redeploy.

## 4. Set the Web Service environment variables

Open the Web Service → **Environment** and add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render database **Internal Database URL** (use the same region) |
| `DATABASE_SSL` | `false` for the Render internal/private database URL |
| `JWT_SECRET` | A newly generated random secret, at least 32 characters |
| `JWT_EXPIRES_IN` | `8h` |
| `ADMIN_NAME` | `EventHub Administrator` |
| `ADMIN_EMAIL` | `admin@nie.ac.in` |
| `ADMIN_PASSWORD` | A new, strong, unique admin password (at least 8 characters) |
| `COLLEGE_EMAIL_DOMAIN` | `nie.ac.in` (optional; enforces NIE email addresses on student sign-up) |
| `SMTP_HOST` | `smtp.gmail.com` (optional; required for email notifications) |
| `SMTP_PORT` | `587` (if using SMTP) |
| `SMTP_SECURE` | `false` (if using port 587) |
| `SMTP_USER` | Your authorized sender email (if using SMTP) |
| `SMTP_PASS` | App password from your email provider (never your normal login password) |
| `SMTP_FROM` | Sender email (usually same as SMTP_USER) |
| `SMTP_FROM_NAME` | `EventHub — NIE College` |

Do not set `PORT`; Render supplies it. Do not use the sample password from `.env.example`.

## 5. Initialize the cloud database (one time)

The project includes `npm run db:setup` to create the tables and seed the admin account/sample events. Run it from your Windows computer using the **External Database URL** copied in step 2:

```powershell
$env:DATABASE_URL='PASTE_YOUR_RENDER_EXTERNAL_DATABASE_URL_HERE'
$env:DATABASE_SSL="true"
$env:ADMIN_NAME='EventHub Administrator'
$env:ADMIN_EMAIL='admin@nie.ac.in'
$env:ADMIN_PASSWORD='YOUR_NEW_STRONG_ADMIN_PASSWORD'
npm run db:setup
```

Run this command from the project folder in VS Code, where `package.json` is located. Replace each placeholder locally; never send the real URL or password to anyone. When it succeeds, clear the temporary terminal variables:

```powershell
Remove-Item Env:DATABASE_URL, Env:DATABASE_SSL, Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
```

The setup command creates five sample events only if the events table is empty. It also sets/updates the admin password to the value you provide, so do not rerun it casually after deployment.

## 6. Pamphlet uploads — required for persistent use

The app stores uploaded event pamphlets as files. Render's default filesystem is temporary. For a paid Render Web Service:

1. Open the service → **Disks** → add a persistent disk.
2. Mount path: `/var/data/uploads`
3. Set service environment variable `UPLOAD_DIR` to exactly `/var/data/uploads`.
4. Save and redeploy.

The application serves files from the configured `UPLOAD_DIR` at the public `/uploads` URL. Only files under the disk mount path persist. A service with a disk is limited to one running instance, which is acceptable for this starter deployment.

For a free demo, do not rely on uploaded pamphlets surviving restarts or redeployments. For a long-term production deployment, consider managed object storage instead of a single-instance disk.

## 7. Open and test the public URL

After Render reports **Live**, open the `https://...onrender.com` URL shown on the service page. Test:

1. The home page opens on a phone using mobile data (not just your own Wi-Fi).
2. `https://YOUR-SERVICE.onrender.com/api/health` returns JSON with `"status":"ok"`.
3. Admin login works with the admin email/password you set.
4. Create an event and upload an image/PDF pamphlet (only after persistent storage is configured).
5. Edit a student account from the admin Student Directory.
6. After an event, select three registered students as winners; the winners appear publicly. Winner emails are sent only when SMTP is configured.
5. Register a test student account, register for an event, and verify it appears in the admin registrations list.
6. Log out and verify student/admin pages require the correct login.

Share the public HTTPS URL with students only after these tests pass. Students need only a browser and internet connection.

## Email notifications

Registration confirmations, welcome messages, and winner announcements use SMTP. Configure the SMTP variables above in the Render Web Service Environment. For Gmail, use an App Password for an account authorized to send institutional mail. If SMTP is not configured, the website still works, but email notifications are not sent. Winner announcements are saved and shown publicly regardless.

## Important production checklist

Before using real student data or accepting fees: ask NIE IT/management to approve the hosting provider and data location; use paid managed hosting/database with backups; configure persistent/object storage; rotate all secrets; review authorization and upload security; configure a transactional email provider if needed; add privacy/retention notices; and test database restoration. This starter project is not a certified institutional system or payment gateway.

## Troubleshooting

- **Build fails:** check Render → service → Logs. Confirm `package.json` is in the repository root and Node 20+ is available.
- **App exits because `JWT_SECRET` is missing:** add it in Render → Environment and redeploy.
- **Database connection fails:** confirm `DATABASE_URL` is the database's Internal URL, both services are in the same region, and `DATABASE_SSL=false` for the internal URL.
- **Tables do not exist:** run the one-time `npm run db:setup` command using the External URL and `DATABASE_SSL=true` from your local project folder.
- **Pamphlet URL returns 404 after a restart:** configure the persistent disk and `UPLOAD_DIR` as described above.
- **Free site is slow on first visit:** free web services spin down after inactivity; use a paid instance for a continuously available service.
