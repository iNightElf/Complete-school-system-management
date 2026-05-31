# Production Deployment Guide

## Prerequisites

- Docker & Docker Compose (recommended), OR
- Node.js 22+, npm, and a PostgreSQL database

## Quick Start with Docker Compose

The easiest way to run the entire stack:

1. Clone the repo and enter the project directory.

2. Create a `.env` file in the project root with:

```env
# Required: change these to secure random values
JWT_SECRET=your-random-secret-here
BETTER_AUTH_SECRET=your-random-secret-here

# Optional: defaults shown
BETTER_AUTH_URL=http://localhost:5000
CORS_ORIGINS=http://localhost:5000
TRUSTED_ORIGINS=http://localhost:5000

# Setup token for first admin bootstrap (generate a UUID)
SETUP_TOKEN=your-setup-token

# Email (SMTP) — optional but needed for password reset
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

3. Build and start:

```bash
docker compose up -d --build
```

4. Apply database schema:

```bash
docker compose exec app npx prisma db push
```

5. Open `http://localhost:5000` and bootstrap the first admin using the setup token.

## Manual Deployment

### 1. Database

Set up PostgreSQL 17+ and create a database. Get the connection string.

### 2. Configure Environment

Copy `server/.env.example` to `server/.env` and fill in your values. Key settings:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random secret for JWT signing |
| `BETTER_AUTH_SECRET` | Random secret for Better Auth |
| `BETTER_AUTH_URL` | Public URL of the app (e.g. `https://school.example.com`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SETUP_TOKEN` | Token for creating the first admin |
| `SMTP_*` | SMTP credentials for email (password reset, etc.) |

### 3. Build Client

```bash
cd client
npm ci
npm run build
```

### 4. Build & Start Server

```bash
cd server
npm ci
npx prisma generate
npx prisma db push
npm run build
npm start
```

The server will serve both the API and the built client files on port 5000.

### 5. First Admin Setup

1. Open the app in your browser.
2. Go to the Register page.
3. Enter the `SETUP_TOKEN` from your environment, create the admin account.
4. After the first admin is created, `SETUP_TOKEN` is no longer needed.

## Deploying to a VPS

### Using Docker on a VPS

```bash
# Copy files to server
rsync -avz --exclude node_modules --exclude .env ./ user@server:/opt/schoolid

# SSH into server
ssh user@server
cd /opt/schoolid

# Create production .env
cp server/.env.example .env
# Edit .env with production values

# Build and run
docker compose up -d --build
```

### Using a Reverse Proxy (Nginx)

For production with a domain and HTTPS:

```nginx
server {
    listen 80;
    server_name school.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name school.example.com;

    ssl_certificate /etc/letsencrypt/live/school.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/school.example.com/privkey.pem;

    # If using Docker, proxy to the app container
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Increase body size for photo uploads
    client_max_body_size 2M;
}
```

## Environment Variables Reference

All environment variables are documented in `server/.env.example` with descriptions.

## Upgrading

```bash
# Pull latest code
git pull

# If using Docker:
docker compose down
docker compose up -d --build

# If manual:
cd client && npm ci && npm run build
cd ../server && npm ci && npx prisma generate && npx prisma db push && npm run build && npm restart
```

## Health Check

The API exposes `GET /health` — returns `{ "status": "ok" }` when the server is running.
