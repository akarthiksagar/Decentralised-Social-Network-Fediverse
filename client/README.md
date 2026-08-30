# Fediverse Client

React + Vite frontend for the decentralized social network.

## Deployment

Build command:

```bash
npm install
npm run build
```

Publish directory:

```bash
dist
```

Required environment variable:

```bash
VITE_API_URL=https://your-api-domain.example
```

React Router requires all paths to serve `index.html`. This folder includes:

- `public/_redirects` for Netlify-style static hosts.
- `vercel.json` for Vercel rewrites.

## Local Development

```bash
npm install
npm run dev
```
