# Gadget Deal Tracker

A full-stack gadget price comparison platform that helps users discover products, compare prices, track price history, manage watchlists, and monitor price changes through alerts.

Built with React, TypeScript, Node.js, Express, and PostgreSQL, the application also integrates AI-powered deal assistance and external shopping APIs.

## Features

### User Features
- Product Discovery: Browse and search gadgets through the product catalogue.
- Price Comparison: Compare gadget prices across available shopping sources.
- Product Details: View product information, pricing, and historical price trends.
- Price History: Track changes in product prices over time.
- Watchlist: Save and manage products you are interested in.
- Price Alerts: Set alerts to monitor price changes.
- Dashboard: Access product activity, saved gadgets, and relevant insights.
- AI Deal Assistance: Get AI-powered assistance when evaluating gadget deals.
- Authentication: Register, log in, and manage user accounts.

### Admin Features
- Admin Dashboard: Manage and monitor catalogue activity.
- Product Management: Manage products in the catalogue.
- Offer Management: Manage product offers.
- Catalogue Synchronization: Monitor and manage product synchronization.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Authentication | JWT, bcryptjs |
| AI Integration | Google Gemini API |
| Shopping Data | RapidAPI integrations |
| Charts | Recharts |
| HTTP Client | Axios |
| Email | Nodemailer (optional configuration) |
| Build Tools | Vite, esbuild |

## Application Architecture

The application follows a unified full-stack architecture.

- The React frontend is located in `src/`.
- The Express backend is located in `backend/src/`.
- The root `server.ts` starts the application and connects the frontend and backend.
- PostgreSQL stores application data.
- External APIs provide shopping data and AI functionality.

**Development:** Express and Vite run together through a single development server.

**Production:** Vite builds the frontend into `dist/`, while esbuild bundles the backend into `dist-server/`. Express serves the frontend and backend API.

## Project Structure

```text
gadget-deal-tracker/
│
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       └── utils/
│
├── src/
│   ├── components/
│   ├── context/
│   ├── pages/
│   │   └── admin/
│   ├── services/
│   └── utils/
│
├── server.ts
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20.x or 22.x
- npm
- PostgreSQL 15 or later
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/ameenuddin357/gadget-deal-tracker.git
cd gadget-deal-tracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local environment file from the example:

```bash
copy .env.example .env.local
```

Configure the required values in `.env.local`:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Application environment |
| `PORT` | Server port |
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SSL` | Database SSL configuration |
| `JWT_SECRET` | Authentication secret (minimum 32 characters) |
| `EMAIL_VERIFICATION_ENABLED` | Keep `false` unless email verification is configured |
| `TRUST_PROXY_HOPS` | Trusted reverse proxy configuration |

Optional integrations:

- `GEMINI_API_KEY` – AI-powered features.
- `RAPIDAPI_KEY` – External shopping API access.
- `RAPIDAPI_HOST` – Amazon shopping API host.
- `GOOGLE_SHOPPING_API_HOST` – Google Shopping API host.
- `FLIPKART_API_HOST` – Flipkart API host.

Refer to `.env.example` for the complete configuration.

**Security:** Never commit `.env.local`, database passwords, API keys, or JWT secrets to GitHub.

### 4. Configure PostgreSQL

Create a PostgreSQL database and configure its connection string in `.env.local`.

Example:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/deal_tracker
DB_SSL=false
```

For a new database, initialize the required schema using the project's database initialization procedure. For an existing database, ensure the required schema is available.

### 5. Run the Application

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The frontend and backend API run through the same server.

### 6. Build for Production

Check TypeScript:

```bash
npm run lint
```

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

Production environment variables must be configured in the hosting environment.

## API Endpoints

The backend API uses the `/api` base path.

| Endpoint | Purpose |
|---|---|
| `/api/health` | Application health check |
| `/api/products` | Product catalogue |

Other endpoints support authentication, watchlists, price alerts, history, dashboard and administration.

## Environment and Security

- Keep credentials in environment variables.
- Use a strong JWT secret.
- Use SSL for hosted PostgreSQL connections.
- Keep email verification disabled unless its email infrastructure is configured.
- Configure trusted proxy settings according to the hosting platform.
- Never expose private API keys in frontend code or public repositories.

## Future Improvements

Potential improvements include:
- Better product search and filtering.
- More shopping platform integrations.
- Improved price tracking and notification workflows.
- Frontend code splitting and performance optimization.
- Expanded analytics and administrative capabilities.

## License

Add your chosen license here if you intend to distribute the project under an open-source license.
