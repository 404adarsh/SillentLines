# Silent Lines Diary

<p align="center">
  <img src="public/logo-192.png" alt="Silent Lines Diary logo" width="120" height="120" />
</p>

<p align="center">
  A local-first diary app with a React + Vite frontend and PHP API for contributors.
</p>

<p align="center">
  <strong>Public-safe by default:</strong> local database only, no production credentials, no production API endpoints, no user data.
</p>

---

## Overview

Silent Lines Diary is a public development version of a private journaling app. It includes the frontend and a local PHP API so contributors can build and test features on their own machine without touching the production server or production user data.

Every contributor should run the backend against their own localhost database.

## Highlights

- React + Vite frontend
- Local PHP API in `php/`
- MySQL local-development defaults
- Auth0-ready login flow
- Mood-based diary writing
- Notes, archive, calendar, profile, and settings views
- Shared-entry reading UI
- Theme and workspace customization
- API base URL configured through `.env`

## Quick start

1. Clone or download this repository to your local web server root.
2. Install frontend dependencies with `npm install`.
3. Copy `.env.example` to `.env` and update the API base URL.
4. Edit `php/secrets.php` with your local backend credentials.
5. Start Vite with `npm run dev` and open `http://localhost:2228`.

## Safety Boundary

This repository is safe for public GitHub because it does not include:

- production database credentials
- production API endpoints
- production server configuration
- real user data
- database dumps
- API keys, SMTP passwords, payment keys, or admin tokens

The repo includes `php/secrets.php` as a local placeholder file. Fill it with your own local values and keep real credentials out of public commits.

The PHP backend defaults to:

```text
host: localhost
username: root
password: blank
database: silentlinesdiary
```

These are local development defaults only. Contributors can override them privately with `php/secrets.php`.

## Project Structure

```text
SillentLines/
  public/          Static assets
  src/             React frontend
  php/             Local PHP API
  .env.example     Frontend environment example
  README.md
  CONTRIBUTING.md
  SECURITY.md
```

## Frontend Setup

Install dependencies:

```bash
npm install
```

Copy the environment example:

```bash
cp .env.example .env
```

Start Vite:

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:2228
```

## PHP API Setup

Place or clone this folder under your local web server document root, for example:

```text
C:\xampp\htdocs\SillentLines
```

The frontend expects the local PHP API at:

```env
VITE_API_BASE_URL=http://localhost/SillentLines/php
```

If your folder name or web server path is different, update `.env` with your own local URL.

## Automatic Database Setup

When you open the frontend on localhost, the app checks whether the local database exists.

If the database is missing, you will see a local setup screen asking:

```text
Do you want to create the local database and tables?
```

If you choose yes, the frontend calls:

```text
php/setup_database.php
```

That endpoint is restricted to localhost requests and does not accept arbitrary database names or SQL from the browser. It creates only the configured local database and the known application tables.

If you choose not now, no database changes are made.

## Local Database Setup

Create a local MySQL database:

```sql
CREATE DATABASE silentlinesdiary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Default local connection:

```text
host: localhost
username: root
password: blank
database: silentlinesdiary
```

To override database settings, copy:

```bash
cp php/secrets.example.php php/secrets.php
```

Then edit `php/secrets.php` locally with your own keys. This repository includes `php/secrets.php` so you can commit a placeholder local config file, but do not publish real secret values in public forks or pull requests.

Manual setup is also available:

```bash
python scripts/setup_database.py
bash scripts/setup_database.sh
```

Both scripts ask before creating anything and use the same local PHP setup code as the browser flow.

## Environment Variables

Frontend `.env` or `.env.local`:

```env
VITE_API_BASE_URL=http://localhost/SillentLines/php
VITE_PUBLIC_BASE_URL=http://localhost:2228
VITE_AUTH0_DOMAIN=your-tenant.region.auth0.com
VITE_AUTH0_CLIENT_ID=your_public_client_id
```

`.env.local` is ignored by Git and is the recommended place for private local values.

All frontend API calls should use:

```text
src/lib/api.js
```

## Auth0 Login Setup

Auth0 is optional for basic UI work, but useful for authenticated screens.

1. Create a free Auth0 account at `https://auth0.com`.
2. Create a **Single Page Application**.
3. Add this to **Allowed Callback URLs**:

```text
http://localhost:2228/login
```

4. Add this to **Allowed Logout URLs**:

```text
http://localhost:2228
```

5. Add this to **Allowed Web Origins**:

```text
http://localhost:2228
```

6. Copy your Auth0 Domain and Client ID from the app settings.
   - Domain: `your-tenant.region.auth0.com` (host only, no `https://` prefix)
   - Client ID: `your_public_client_id`

7. Put your own local Auth0 values in `.env`:

```env
VITE_AUTH0_DOMAIN=your-tenant.region.auth0.com
VITE_AUTH0_CLIENT_ID=your_public_client_id
```

> If you save the config through the app setup screen instead of `.env`, enter only the Auth0 domain hostname and client ID.

If you need help finding these values, use the Auth0 SPA quickstart:

https://auth0.com/docs/quickstart/spa/react

Do not commit organization-specific Auth0 values.

## Adding Features

Good contribution areas:

- UI polish
- accessibility
- responsive layout fixes
- new frontend features
- local PHP endpoint improvements
- empty, loading, and error states
- documentation

Rules for new features:

- keep API URLs configurable
- use `src/lib/api.js`
- keep PHP connected to localhost/private contributor databases
- never hardcode production endpoints
- never commit secrets or real diary data
- validate user ownership before returning private diary data

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Contributing

1. Fork the repository.
2. Create a branch.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Configure your local PHP API and database.
6. Make your change.
7. Run `npm run build`.
8. Open a pull request with screenshots for UI changes.

## Contact

For general questions, feature ideas, and contributor help:

- Open a GitHub issue
- Start a GitHub discussion, if enabled
- Comment on the relevant pull request

For security reports, do not open a public issue. See [SECURITY.md](SECURITY.md).

## License

MIT License. See [LICENSE](LICENSE).
