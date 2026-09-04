# Gadget Deal Tracker

A full-stack web application for discovering, comparing, and tracking gadget prices across multiple online stores.

The application allows users to search for products, view price information, compare products, track price history, create price alerts, and manage a personal watchlist.

## Features

- User registration and login
- Secure JWT-based authentication
- Product search and filtering
- Product listing with pagination
- Detailed product information
- Product price history
- Product comparison
- Personal watchlist
- Price-drop alerts
- Email notifications
- Dashboard and search history
- Product data integration through external shopping APIs
- API usage and quota management

## Tech Stack

### Frontend
- React
- TypeScript
- Vite

### Backend
- Node.js
- Express.js
- TypeScript

### Database
- PostgreSQL

### Other Technologies
- JWT Authentication
- Nodemailer
- REST APIs
- RapidAPI
- Google Shopping product data integration

## Project Structure

```text
gadget-deal-tracker/
│
├── src/                    # React frontend
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── services/
│   └── utils/
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
├── server.ts
├── package.json
├── vite.config.ts
└── README.md
```

## How It Works

1. Users register or log in to the application.
2. The frontend communicates with the backend through REST APIs.
3. The backend handles authentication, product operations, watchlists, alerts, and price-history requests.
4. PostgreSQL stores application data such as users, products, prices, watchlists, alerts, and price history.
5. External shopping APIs are used to obtain product information.
6. Users can monitor products and use historical price information to make better purchasing decisions.

## Run Locally

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- PostgreSQL

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd gadget-deal-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root.

Use `.env.example` as a reference and provide your own local database credentials, JWT secret, and API credentials where required.

Never commit your `.env` file or private credentials to GitHub.

### 4. Prepare PostgreSQL

Create or configure the PostgreSQL database specified in your `.env` configuration.

### 5. Start the application

```bash
npm run dev
```

The development server runs on:

```text
http://localhost:3000
```

## Security

Sensitive values such as database passwords, JWT secrets, API keys, and SMTP credentials are stored using environment variables and are excluded from Git using `.gitignore`.

## Future Improvements

- Improve product-price comparison across stores
- Enhance price-history analytics
- Improve automated price-drop notifications
- Add more shopping data sources
- Improve mobile responsiveness and user experience

## Author

**Shaik Ameenuddin**

B.Tech Computer Science and Engineering student interested in Java, backend development, full-stack development, and software engineering.
