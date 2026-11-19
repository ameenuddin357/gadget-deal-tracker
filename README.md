# Gadget Tracker Pro

Full-stack gadget price comparison, saved gadgets, price history, price alerts, and admin catalogue management portal built with **React + Vite + Tailwind CSS**, **Express + TypeScript**, and **PostgreSQL**.

---

## Architecture Overview

Gadget Tracker Pro uses a **unified full-stack Node.js server** (`server.ts`):
- **Single root `package.json`** manages both frontend (`src/`) and backend (`backend/src/`) dependencies.
- **Development mode (`npm run dev`)**: Express mounts the backend REST API (`/api/*`) and Vite's frontend middleware together on **http://localhost:3000**.
- **Production mode (`npm run build` + `npm start`)**: Vite builds the frontend into `dist/`, `esbuild` bundles the backend into `dist-server/server.cjs`, and Express serves both the API and the static SPA on the configured `PORT` (default `3000`).

---

## Windows Local Setup Instructions

### 1. Required Software and Versions
- **Node.js**: `v20.x` or `v22.x` LTS (tested on Node `v22.23.2` and npm `10.9.8`) — download from [nodejs.org](https://nodejs.org/).
- **npm**: `v10.x` (bundled with Node.js).
- **PostgreSQL**: `v15+` or `v16+` (either local PostgreSQL for Windows or a hosted PostgreSQL database such as Neon / Render / Supabase).
- **Git** (optional, for pushing to GitHub): [git-scm.com](https://git-scm.com/).
- **Terminal**: Windows PowerShell, Windows Terminal, or VS Code integrated terminal.

Verify Node and npm in PowerShell:
```powershell
node -v
npm -v
```

### 2. Extract the ZIP
1. Right-click `gadget-tracker-pro.zip` in File Explorer -> **Extract All...** (or extract to a clean path without special characters, e.g., `C:\Projects\gadget-tracker-pro`).
2. Open PowerShell in the extracted project folder:
   ```powershell
   cd C:\Projects\gadget-tracker-pro
   ```

### 3. Install Frontend Dependencies
All frontend (`src/`) and backend (`backend/src/`) dependencies are managed together in the **root `package.json`** and pinned in `package-lock.json`.

From the project root directory, run:
```powershell
npm install
```

### 4. Install Backend Dependencies
Backend packages (`express`, `pg`, `bcryptjs`, `jsonwebtoken`, `helmet`, `nodemailer`, `tsx`, `esbuild`, etc.) are **already installed by the root `npm install` above**.
- You do **not** need to run `npm install` inside `backend/`.
- `backend/package.json` is preserved only as legacy reference metadata; the unified server runs exclusively from the root `package.json`.

### 5. Required Environment Variables
Create a `.env.local` file in the project root by copying `.env.example`:
```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and configure the values below. **Never commit `.env.local` or real secrets to GitHub.**

#### A. Required for Local Development (`.env.local`)
| Variable | Local Example / Requirement | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Enables Vite middleware and local `.env.local` loading |
| `PORT` | `3000` | Port for both frontend and backend API |
| `DATABASE_URL` | `postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/deal_tracker` | Primary PostgreSQL connection string |
| `DB_SSL` | `false` *(for local Postgres)* / `true` *(for hosted Postgres)* | Enables TLS for PostgreSQL (`true` exact lowercase) |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` *(or `false` only if your host uses self-signed certs)* | Evaluated only when `DB_SSL=true` |
| `DB_POOL_MAX` | `10` | Optional pool size (`1`–`20`, default `10`) |
| `JWT_SECRET` | Any random string **>= 32 characters** | Required at startup to sign/verify auth JWTs |
| `EMAIL_VERIFICATION_ENABLED` | `false` | **Keep `false`** (no external paid email service required) |
| `TRUST_PROXY_HOPS` | `0` | Direct local connections (no reverse proxy) |

*(Optional local features — leave as placeholder if unused: `GEMINI_API_KEY` for AI Deal Advisor; `RAPIDAPI_KEY`, `RAPIDAPI_HOST`, `GOOGLE_SHOPPING_API_HOST`, `FLIPKART_API_HOST` for admin-only sync.)*

Generate a secure random `JWT_SECRET` in PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

#### B. Required Only for Production (e.g., Render / Cloud Hosting)
In production (`NODE_ENV=production`), `.env.local` is **ignored**; configure these in your hosting provider's Environment Variables dashboard:
| Variable | Production Setting | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Serves built `dist/` static frontend and hides dev logs |
| `PORT` | Provided by host (or `3000`) | Server binds to `0.0.0.0:$PORT` |
| `DATABASE_URL` | Managed PostgreSQL connection URL | Primary production DB connection |
| `DB_SSL` | `true` | Required by most managed PostgreSQL hosts |
| `DB_SSL_REJECT_UNAUTHORIZED` | `true` *(set `false` only if host requires it)* | Strict TLS certificate check by default |
| `JWT_SECRET` | Unique random secret (`48–64+` chars) | Must differ from local dev secret |
| `EMAIL_VERIFICATION_ENABLED` | `false` | Keeps email verification disabled without SMTP |
| `TRUST_PROXY_HOPS` | `1` | Required behind Render/Nginx reverse proxy for accurate rate-limit IPs |
| `APP_URL` | `https://your-production-domain.onrender.com` | Canonical public URL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Optional | Only needed if you later configure SMTP for password reset / price alert emails |
| `EMAIL_VERIFICATION_SECRET` | Optional | Only required if you ever set `EMAIL_VERIFICATION_ENABLED=true` (must be >= 32 chars and differ from `JWT_SECRET`) |

### 6. Configure the Database Connection
`backend/src/config/db.ts` connects using:
1. **`DATABASE_URL`** (recommended for both local PostgreSQL and hosted databases), **or**
2. Individual fallback variables (`SQL_HOST`, `DB_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) if `DATABASE_URL` is not set.

**Option A — Connect to an existing PostgreSQL database (or restored dump):**
- Point `DATABASE_URL` in `.env.local` to your database (set `DB_SSL=true` if remote).
- On startup, `server.ts` runs `verifyDatabaseSchema()` (read-only check verifying all 13 required tables and columns exist).

**Option B — Brand-new empty local PostgreSQL database:**
1. Create a database named `deal_tracker` in pgAdmin or `psql`:
   ```sql
   CREATE DATABASE deal_tracker;
   ```
2. Set `DATABASE_URL` and `DB_SSL=false` in `.env.local`.
3. Initialize the 13 required tables and baseline categories/stores once:
   ```powershell
   npx tsx -e "import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' }); import { initializeDatabase } from './backend/src/config/initDb.ts'; initializeDatabase().then(() => process.exit(0));"
   ```

### 7. Start the Backend
Because Gadget Tracker Pro runs a unified Express + Vite server, starting the backend also starts the frontend middleware:

**Development mode:**
```powershell
npm run dev
```

**Production-mode local test:**
```powershell
npm run build
$env:NODE_ENV="production"
npm start
```
*(In `production` mode, set required env vars in PowerShell or your shell environment since `.env.local` is intentionally not loaded when `NODE_ENV=production`.)*

### 8. Start the Frontend
- When running `npm run dev`, the React/Vite frontend is automatically served by `server.ts` on **http://localhost:3000** — no separate second terminal is needed.
- TypeScript verification and build commands:
  ```powershell
  npm run lint
  npm run build
  ```

### 9. Local URLs for Frontend and Backend
| Service | Local URL |
|---|---|
| Frontend Web App (SPA) | `http://localhost:3000` |
| Backend REST API Base | `http://localhost:3000/api` |
| Public Catalogue Endpoint | `http://localhost:3000/api/products` |
| Health Check Endpoint | `http://localhost:3000/api/health` |

### 10. Verify the Health Endpoint
Open `http://localhost:3000/api/health` in your browser, or run in PowerShell:
```powershell
Invoke-RestMethod http://localhost:3000/api/health
```
Expected HTTP `200` JSON response:
```json
{
  "status": "success",
  "message": "Unifed Full-Stack E-Commerce Portal is live and connected!",
  "timestamp": "..."
}
```

### 11. Common Windows Errors and How to Resolve Them
| Error | Cause | Fix |
|---|---|---|
| `CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing or too short` | `.env.local` missing or `JWT_SECRET` < 32 chars | Create `.env.local` from `.env.example` and set a random 32+ char `JWT_SECRET` |
| `Database schema readiness check failed: Missing required table(s)` | Connected to an empty PostgreSQL DB | Restore your SQL dump or run the `initializeDatabase()` one-liner in Step 6 |
| `ECONNREFUSED 127.0.0.1:5432` | Local PostgreSQL service is not running | Open Windows **Services** (`services.msc`) and start `postgresql-x64-*` |
| `no pg_hba.conf entry ... SSL off` or `self-signed certificate` | Managed Postgres requires SSL | Set `DB_SSL=true` in `.env.local` (and `DB_SSL_REJECT_UNAUTHORIZED=false` only if provider requires it) |
| `EADDRINUSE: address already in use :::3000` | Another process is using port 3000 | Stop the other process or set `PORT=3001` in `.env.local` |
| PowerShell `execution policy` error running `npm` / `npx` | Windows script execution policy | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in PowerShell |
| Production `npm start` fails with `JWT_SECRET` missing | `NODE_ENV=production` intentionally skips `.env.local` | Export env vars in the shell before `npm start`, or test locally with `npm run dev` |
