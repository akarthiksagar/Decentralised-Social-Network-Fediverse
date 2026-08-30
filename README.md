# Decentralised Social Network Fediverse

A modern decentralized social media platform built with ActivityPub, allowing users on independent servers to communicate, follow each other, and share content across the Fediverse while maintaining data ownership and privacy.

## Project Structure

- `client/` - React + Vite frontend.
- `server/` - Express API, Prisma/PostgreSQL, ActivityPub federation, BullMQ worker.

## Deployment Overview

Deploy this as three processes/services:

1. API server: `server`, runs `npm start`.
2. Federation worker: `server`, runs `npm run worker`.
3. Frontend: `client`, static build from `npm run build`.

You also need:

- PostgreSQL database.
- Redis instance for BullMQ federation delivery.

## Server Deployment

Set the service root/build directory to `server`.

Install/build command:

```bash
npm install
npm run build
npm run prisma:push
```

Start command:

```bash
npm start
```

Worker command, as a separate background worker service:

```bash
npm run worker
```

For the first deployment this project uses `prisma db push` because migrations have not been created yet. After the schema stabilizes, create migrations locally and switch deployment to:

```bash
npm run prisma:deploy
```

## Server Environment Variables

Copy `server/.env.example` into your deployment platform and replace the values:

- `DATABASE_URL`
- `REDIS_URL`
- `PUBLIC_BASE_URL`
- `CLIENT_URL`
- `CLIENT_URLS`
- `JWT_SECRET`
- `SERVER_DOMAIN`
- `LOCAL_DOMAIN`
- `INSTANCE_NAME`
- `INSTANCE_RULES`
- `REGISTRATIONS_OPEN`

For production federation, use HTTPS URLs and keep `REQUIRE_HTTP_SIGNATURES=true`.

## Frontend Deployment

Set the service root/build directory to `client`.

Build command:

```bash
npm install
npm run build
```

Publish directory:

```bash
dist
```

Set:

```bash
VITE_API_URL=https://your-api-domain.example
VITE_SERVER_NAME=Your Server Name
VITE_SERVER_DOMAIN=your-server.example
```

For multiple real backend instances, set `VITE_SERVER_DIRECTORY` to JSON containing only deployed servers:

```bash
VITE_SERVER_DIRECTORY=[{"name":"Main Social","domain":"main.example","apiUrl":"https://api.main.example","category":"General","registrations":"Open"}]
```

The frontend includes static-host rewrites for React Router:

- `client/public/_redirects` for Netlify-style hosts.
- `client/vercel.json` for Vercel.

## Local Development

Run the API:

```bash
cd server
npm install
npm run prisma:push
npm start
```

Run the federation worker:

```bash
cd server
npm run worker
```

Run the frontend:

```bash
cd client
npm install
npm run dev
```
