# Deploy runbook

1. Push to `main`; CI builds and pushes the images.
2. On the server: `docker compose pull && docker compose up -d`.
3. Check `https://app.alpha.example.com/health`.

The database URL comes from `$DATABASE_URL` on the server; it is never written here.
