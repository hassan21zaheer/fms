# Feedback Management System

Multi-tenant Feedback Management System.

```
D:\fms
├── backend\    Laravel API (PHP, database, queue, tests)
├── frontend\   React app (admin panel and guest feedback form)
└── docs\       Product documents
```

## Requirements

- Laragon (PHP 8.3, MySQL, Composer)
- Project path: `D:\fms`

## Quick start

Double-click `D:\fms\start-fms.bat`. It starts the database check, API, alert workers and website, and opens `http://localhost:3100`. `D:\fms\stop-fms.bat` stops them.

## Backend (Laravel API)

1. Laragon → **Start All**
2. Run API:

```bat
cd /d D:\fms\backend
serve.bat
```

3. Send queued alert emails and run scheduled summaries (second terminal, keep it open):

```bat
cd /d D:\fms\backend
start-workers.bat
```

Base URL: `http://127.0.0.1:8000/api/v1`

Database backups are saved to `backend\database\backups` every night at 02:00 (while `start-workers.bat` is running) or on demand with `backend\backup-database.bat`. The last 14 are kept. To restore one: `mysql -u root -p fms < backend\database\backups\fms-DATE.sql`.

All `php artisan`, `composer`, test and Pint commands run from `D:\fms\backend`.

## Frontend (React)

```bat
cd /d D:\fms\frontend
npm install
npm run dev
```

UI: `http://127.0.0.1:3100`  
Login/signup are live and talk to the API.

For production run `npm run build`. It writes into `backend\public\app`, and Laravel serves it from the same domain.

## Demo accounts

Development only. With `APP_ENV=production`, `php artisan db:seed` creates no demo data: only roles, plans and one Owner account. Set `FMS_OWNER_EMAIL` and `FMS_OWNER_PASSWORD` in `.env` before seeding, or the seeder generates a password and shows it once in the console. Re-running it never resets an existing Owner.

| Role | Email | Password |
|---|---|---|
| Owner (whole platform: organizations and plans) | owner@fms.test | password |
| Superadmin (one organization: branches and team) | superadmin@demohotel.test | password |
| Branch Admin | admin@demohotel.test | password |
| Staff / Manager | staff@demohotel.test | password |

Demo public form:

`GET /api/v1/f/demo-hotel/downtown/room-101`

## API map

### Public
- `GET /f/{org}/{branch}/{location}` — load branded form
- `POST /f/{org}/{branch}/{location}/submit` — submit answers (score + auto-flag + case)

### Auth
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password` (auth)
- `POST /auth/logout` / `POST /auth/logout-all` (auth)
- `GET /auth/me` (auth)

Protected routes require Sanctum token **and** matching Spatie permission.
Inactive users are blocked by `active` middleware.

### Admin
- `GET /dashboard`
- `GET|POST /organizations` (platform owner)
- `CRUD /branches`
- `CRUD /locations`
- `POST /locations/{id}/qr` + `GET .../qr/download`
- `GET|POST|PATCH /forms`
- `POST /forms/{id}/questions`
- `POST /forms/{id}/questions/reorder`
- `PATCH|DELETE /questions/{id}`
- `GET /templates` + `POST /templates/apply`
- `GET /feedback` + `GET /feedback/{id}`
- `GET|PATCH /cases/{id}` + `POST /cases/{id}/notes`
- `GET /customers` + `GET /customers/{id}`
- `CRUD /users`
- `GET /reports/summary`
- `GET /reports/export.csv`
- `GET /reports/export.pdf`
- `GET|PATCH /settings/*`

## Included product coverage

- Multi-tenant orgs / branches / locations
- Four roles — Owner (platform), Superadmin (one organization), Branch Admin, Staff / Manager — with permissions enforced on routes + active-user middleware
- Password forgot/reset/change + logout-all
- Form builder + industry templates (hotel, restaurant, clinic)
- Weighted scoring + flagging + cases
- Answer snapshots for historical reports
- Customers history + email/WhatsApp outreach APIs
- Plans/subscriptions for platform owner + branch limits
- Custom domain connect/verify + host resolve
- Captcha on public submit
- Logo upload
- QR generation/download
- Reports JSON/CSV/PDF + case resolution time + recommendations
- Weekly summary scheduler (`php artisan fms:send-weekly-summaries`)
- Follow-up-on-low validation
- Org-form per-branch question overrides
- Translations + RTL flags (`?locale=ur`)
- Category CRUD
- Organization suspend/activate/soft-delete/restore
- Duplicate submission window
- Rate-limited public endpoints
- Flagged-feedback email job (+ WhatsApp deep link in mail)

## Reset demo data

```bat
php artisan migrate:fresh --seed
php artisan storage:link
```
# fms
