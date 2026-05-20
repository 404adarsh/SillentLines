# Contributing

Thanks for helping improve Silent Lines Diary.

## Workflow

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feature/your-change
```

3. Install dependencies:

```bash
npm install
```

4. Copy the example environment file:

```bash
cp .env.example .env
```

5. Confirm `VITE_API_BASE_URL` points to your local API:

```env
VITE_API_BASE_URL=http://localhost/mydiary-api
```

6. Start development:

```bash
npm run dev
```

7. Run a production build before opening a pull request:

```bash
npm run build
```

8. Submit a pull request with a concise summary and screenshots for UI changes.

## Security Rules

Do not commit secrets, API keys, tokens, credentials, SQL files, database dumps, production configs, exported user data, or real diary content.

All API calls must use `src/lib/api.js` and `VITE_API_BASE_URL`.
