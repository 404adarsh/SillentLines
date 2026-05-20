# Silent Lines Diary

<p align="center">
  <img src="public/logo-192.png" alt="Silent Lines Diary logo" width="120" height="120" />
</p>

<p align="center">
  A calm, private journaling frontend built with React and Vite.
</p>

<p align="center">
  <strong>Frontend only.</strong> No production backend, no user data, no secrets, no database files.
</p>

---

## Overview

Silent Lines Diary is the public frontend repository for a private diary experience. It is designed so contributors can safely improve the user interface, writing flows, themes, accessibility, and frontend features without access to production infrastructure or private diary data.

The production backend, database, credentials, API keys, SQL schemas, and real user content are intentionally not included in this repository.

## Highlights

- React + Vite frontend
- Auth0-ready login flow
- Private diary writing screens
- Mood-based journaling experience
- Notes, archive, calendar, profile, and settings views
- Shared-entry reading UI
- Theme and workspace customization
- Central API configuration through `src/lib/api.js`
- Public-safe setup for open-source contributors

## Preview

<p align="center">
  <img src="public/logo-512.png" alt="Silent Lines Diary preview placeholder" width="220" />
</p>

Screenshots and demo images will be added here as the public UI evolves.

## Public Repository Scope

This repository includes:

- `src/` frontend source code
- `public/` static assets
- `package.json`
- `vite.config.js`
- `.env.example`
- contribution and security documentation

This repository does not include:

- PHP backend source code
- SQL schemas or migrations
- database dumps
- sample user data
- production configs
- API keys, tokens, SMTP credentials, payment keys, or admin secrets

## Tech Stack

- React
- Vite
- React Router
- Auth0 React SDK
- Tailwind CSS
- Lucide React icons
- Chart.js
- jsPDF

## Getting Started

Clone the repository:

```bash
git clone https://github.com/404adarsh/SillentLines.git
cd SillentLines
```

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:2228
```

## Environment Variables

The frontend uses environment variables prefixed with `VITE_`.

```env
VITE_API_BASE_URL=http://localhost/mydiary-api
VITE_PUBLIC_BASE_URL=http://localhost:2228
VITE_AUTH0_DOMAIN=
VITE_AUTH0_CLIENT_ID=
```

All API requests should use:

```text
src/lib/api.js
```

Do not hardcode API URLs inside pages or components.

## Auth0 Login Setup

Auth0 is optional for basic frontend work, but useful if you want to test authenticated screens locally.

1. Create a free Auth0 account at `https://auth0.com`.
2. Create a new application.
3. Choose **Single Page Application**.
4. Open the application settings.
5. Add this to **Allowed Callback URLs**:

```text
http://localhost:2228
```

6. Add this to **Allowed Logout URLs**:

```text
http://localhost:2228
```

7. Add this to **Allowed Web Origins**:

```text
http://localhost:2228
```

8. Copy your Auth0 domain and client ID into `.env`:

```env
VITE_AUTH0_DOMAIN=your-tenant.region.auth0.com
VITE_AUTH0_CLIENT_ID=your_public_client_id
```

Auth0 client IDs are public identifiers, but contributors should still use their own local Auth0 application values. Never commit organization-specific Auth0 configuration.

## Working With A Local API

The frontend can connect to a compatible local API:

```env
VITE_API_BASE_URL=http://localhost/mydiary-api
```

The API implementation is private and not part of this public repository. You can still build UI features, improve layouts, and review frontend behavior without production backend access.

If you add a new API call, route it through `src/lib/api.js` and keep the endpoint configurable through `VITE_API_BASE_URL`.

## Available Scripts

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run linting:

```bash
npm run lint
```

Preview the production build:

```bash
npm run preview
```

## How To Contribute

We welcome frontend contributions.

Good contribution areas:

- UI polish
- accessibility improvements
- responsive layout fixes
- new frontend-only features
- theme improvements
- empty states and loading states
- copy improvements
- component refactors
- tests and quality improvements
- documentation updates

Contribution workflow:

1. Fork the repository.
2. Create a branch:

```bash
git checkout -b feature/your-feature-name
```

3. Install dependencies:

```bash
npm install
```

4. Copy the environment example:

```bash
cp .env.example .env
```

5. Make your frontend changes.
6. Run:

```bash
npm run build
```

7. Open a pull request.

For UI changes, include screenshots or a short screen recording when possible.

## Adding New Features

When adding a frontend feature:

- Keep changes focused and easy to review.
- Follow existing component and styling patterns.
- Use `src/lib/api.js` for backend requests.
- Keep API URLs configurable.
- Do not add backend credentials or production endpoints.
- Do not commit `.env`.
- Do not include real diary content in fixtures, screenshots, or tests.
- Add helpful empty, loading, and error states.
- Make sure the UI works on mobile and desktop.

If a feature requires backend support, open an issue or pull request describing the frontend need and expected API shape without including private backend code.

## Security And Privacy

This project is built around private diary content, so the public repository has a strict boundary.

Never commit:

- real diary entries
- user records
- API keys
- access tokens
- database credentials
- SQL files
- database dumps
- SMTP credentials
- payment keys
- admin secrets
- production backend code
- production server configuration

Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Contact

For general questions, feature ideas, and frontend contribution discussion:

- Open a GitHub issue
- Start a GitHub discussion, if discussions are enabled
- Comment on the relevant pull request

For security issues, do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

Silent Lines Diary is released under the MIT License. See [LICENSE](LICENSE).
