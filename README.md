<<<<<<< HEAD
# Event-Hub
CDD Project
=======
# EventHub — College Event Registration & Check-in System

A fresh starter project using HTML, CSS, JavaScript, Node.js, Express, PostgreSQL and Docker Compose.

## Features
- Student registration and login with JWT authentication
- Admin account seeded from environment variables
- Browse events and register as a student
- Registration history and cancellation
- Admin event creation, pamphlet upload (images/PDF), registration list and attendance check-in
- Top three winners for completed events with fixed prizes: ₹3,000, ₹2,000 and ₹1,000
- Optional welcome and registration confirmation emails through SMTP
- PostgreSQL data and uploaded pamphlets persisted in Docker volumes

## Requirements
- Docker Desktop
- Windows 10/11
- A browser

## Run on Windows
1. Extract this ZIP.
2. Open the `EventHub_Fresh` folder in VS Code.
3. Copy `.env.example` and name the copy `.env`.
4. Open `.env` and set `DB_PASSWORD` to a password you choose. Use the same value in the `DATABASE_URL` password segment after `postgres:` and before `@db`. Set a long unique `JWT_SECRET`. Set a new `ADMIN_PASSWORD`.
5. For Gmail email notifications, configure `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Use a Google App Password, not your normal Gmail password. Email settings are optional; the app still works without them.
6. Open VS Code Terminal in the folder containing `docker-compose.yml`.
7. Run:
   ```powershell
   docker compose up -d --build
   ```
8. Open http://localhost:3001
9. Check services with:
   ```powershell
   docker compose ps
   ```
10. View app logs:
   ```powershell
   docker compose logs -f app
   ```

## Admin login
Use the email and password you set in `.env`:
- Email: value of `ADMIN_EMAIL`
- Password: value of `ADMIN_PASSWORD`

Use a strong unique admin password. The startup seed script updates the admin account to the `ADMIN_PASSWORD` configured in `.env`; keep that value private and do not change it unexpectedly after deployment.

## Stop the application
```powershell
docker compose down
```
Do not use `docker compose down -v` unless you intentionally want to delete the database and uploaded-file volumes.

## Email configuration
Set these in `.env`:
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=your-gmail-address`
- `SMTP_PASS=your-16-character-google-app-password`
- `SMTP_FROM=your-gmail-address`
- `SMTP_FROM_NAME=EventHub`

Never upload or commit `.env`.

## Important notes
- This Compose setup runs locally. `http://localhost:3001` is available on the computer running Docker. To let students use the same live website and shared database from anywhere, deploy the app and database to a suitable cloud host and configure production secrets, HTTPS, backups and file storage.
- SMS notifications are not included; an SMS provider and credentials are needed.
- The application is a starter implementation. Review security, privacy, payment handling and deployment settings before real institutional use.


## Public cloud deployment

For step-by-step deployment so students can access EventHub from anywhere, follow [DEPLOY_RENDER.md](DEPLOY_RENDER.md). Deploy the full-stack application as a Render Web Service and connect a managed PostgreSQL database. Configure persistent storage before relying on event pamphlet uploads.


## Updated student and admin workflows

- Student registration dialog scrolls independently on phones and desktops, including the department/year fields.
- Admin Student Directory shows student account creation dates and provides an edit action for name, college email, phone, department, year, and optional password reset.
- Admin event form supports image/PDF pamphlet uploads and event editing.
- For completed events, admins select three distinct registered participants as winners. The announcement appears on the public event listing and email notifications are sent when SMTP is configured.
- Admin can view all student accounts and event registrations, including student college emails and registration timestamps.

See [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for the guided public deployment procedure. Configure a persistent disk/object storage for uploaded pamphlets before public production use.

## PostgreSQL password mismatch on an existing Docker volume

If Docker logs show PostgreSQL error `28P01` (`password authentication failed for user "postgres"`), the database volume was initialized with a different password than the current `.env`. Changing `.env` alone does not change a password already stored in PostgreSQL. Keep the volume and reset the database role password from the local database socket:

```powershell
# Run from the folder containing docker-compose.yml
docker compose exec -u postgres db psql -d eventhub -c "ALTER USER postgres WITH PASSWORD 'YOUR_NEW_DB_PASSWORD';"
```

Then set `DB_PASSWORD=YOUR_NEW_DB_PASSWORD` and make the password in `DATABASE_URL` exactly the same. Recreate only the app container:

```powershell
docker compose up -d --force-recreate app
```

Do not use `docker compose down -v` to fix authentication; that deletes database and upload volumes.
>>>>>>> c380581 (Initial commit - EventHub College Event Management System)
