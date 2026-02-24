# Altair Frontend (UI)

This repository contains the Next.js UI for Altair and proxies API requests to the backend service.

## Run Locally

```bash
corepack yarn install
corepack yarn dev
```

Frontend runs at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_ALCHEMY_API_KEY` (optional but recommended)
- `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:3001`)
