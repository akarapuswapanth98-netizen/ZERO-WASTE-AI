# ZeroWaste AI — Production Deployment Guide (Vercel + Neon)

This guide provides step-by-step instructions for deploying **ZeroWaste AI** to Vercel as two separate projects originating from a single GitHub repository.

---

## Architecture Overview

```
                          ┌───────────────────────────┐
                          │   GitHub Repository       │
                          │   (monorepo layout)       │
                          └─────────────┬─────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│       Project 1: Backend        │           │       Project 2: Frontend       │
│  - Root Directory: backend/     │           │  - Root Directory: frontend/    │
│  - Framework: Other (FastAPI)   │           │  - Framework: Next.js           │
│  - Entrypoint: app/main.py      │           │  - Server-side API Proxy        │
└────────────────┬────────────────┘           └────────────────┬────────────────┘
                 │                                             │
                 │   X-API-Key Proxy Traffic                   │
                 │◄────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────┐
│      Neon Serverless Postgres   │
│  - Pooled Connection String     │
│  - Max Pool: 3 (serverless)     │
└─────────────────────────────────┘
```

---

## Step 1: Database Provisioning (Neon PostgreSQL)

1. Log into your [Neon Console](https://console.neon.tech/) or navigate to the **Storage** tab in your Vercel Dashboard and select **Neon Postgres**.
2. Create a new database project named `zerowaste-prod`.
3. In the connection details, select **Pooled connection** (port `6543` or `-pooler` hostname) to prevent serverless connection exhaustion.
4. Copy the connection URI:
   ```text
   postgresql://[user]:[password]@[neon-pooler-hostname]/zerowaste-prod?sslmode=require
   ```

---

## Step 2: Deploy Project 1 — FastAPI Backend

1. In the [Vercel Dashboard](https://vercel.com/), click **Add New...** > **Project**.
2. Select your repository.
3. Configure Project Settings:
   - **Project Name**: `zerowaste-ai-api`
   - **Framework Preset**: `Other`
   - **Root Directory**: Click *Edit* and select `backend`.
4. Configure Environment Variables:
   | Variable Name | Value | Purpose |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | Neon pooled connection string | Connects to PostgreSQL database |
   | `API_KEY` | Long random secret string (e.g., 32+ characters) | Enforces fail-closed API security |
   | `ADMIN_TOKEN` | Separate long random string | Protects `/api/admin/reset` and `/reseed` |
   | `PRODUCTION` | `1` | Enables production security mode |
   | `FRONTEND_ORIGIN` | `https://your-frontend-project.vercel.app` (or `*`) | CORS origin allowance |
   | `DEMO_MODE` | *Leave Unset* | **Critical**: Backend refuses to start if `DEMO_MODE=True` in production |
5. In `backend/vercel.json`, verify function timeout and build configuration:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "builds": [
       {
         "src": "app/main.py",
         "use": "@vercel/python",
         "config": {
           "maxDuration": 30
         }
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "app/main.py"
       }
     ],
     "excludeFiles": [
       "tests/**",
       "pytest.ini",
       ".pytest_cache/**"
     ]
   }
   ```
6. Click **Deploy**.
7. Once deployed, test the health check endpoint:
   ```bash
   curl -s https://zerowaste-ai-api.vercel.app/api/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "zerowaste-ai-backend",
     "database_connected": true,
     "demo_mode": false,
     "is_production": true,
     "as_of_date": "2026-10-12"
   }
   ```

---

## Step 3: Deploy Project 2 — Next.js Frontend

1. In the Vercel Dashboard, click **Add New...** > **Project**.
2. Select the **same** repository again.
3. Configure Project Settings:
   - **Project Name**: `zerowaste-ai`
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `frontend`.
4. Configure Environment Variables:
   | Variable Name | Value | Purpose |
   | :--- | :--- | :--- |
   | `ZEROWASTE_API_BASE` | `https://zerowaste-ai-api.vercel.app` | URL of deployed FastAPI backend |
   | `ZEROWASTE_API_KEY` | *Same secret string as backend `API_KEY`* | Server proxy authenticates to backend |
   | `ADMIN_TOKEN` | *Same secret string as backend `ADMIN_TOKEN`* | Allows admin actions through proxy |
   *Notice: Zero `NEXT_PUBLIC_` secrets are defined. All credentials remain on the server side.*
5. Click **Deploy**.

---

## Step 4: Verification & Function Duration Verification

1. **Verify Backend Connectivity**: Open `https://your-frontend-project.vercel.app` and confirm all stat chips load without errors.
2. **Check Function Duration Limits**:
   - Go to your Vercel Project Dashboard > **Settings** > **Functions**.
   - Review your plan's maximum execution duration (Hobby plans default to 10s or 15s, Pro plans allow up to 60s/300s).
   - Ensure the backend configuration (`maxDuration: 30`) aligns with your plan tier.
3. **Verify Database Seeding**:
   - On first startup against an empty Neon database, the backend automatically runs `apply_schema()` and `seed_database()` idempotently.
   - If reseeding is needed manually, execute:
     ```bash
     curl -X POST https://your-frontend-project.vercel.app/api/admin/reseed \
       -H "X-Admin-Token: your_admin_token"
     ```

---

## Troubleshooting & Common Pitfalls

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| Backend crashes on boot with `FAIL-CLOSED SECURITY` | `API_KEY` is empty or `DEMO_MODE=True` was set in production | Ensure `PRODUCTION=1`, leave `DEMO_MODE` unset, and supply a long random `API_KEY`. |
| Database connection timeouts | Raw connection used instead of pooled connection | Change connection string host to the Neon `-pooler` endpoint. |
| Client requests return 401 Unauthorized | Frontend `ZEROWASTE_API_KEY` does not match backend `API_KEY` | Ensure both environment variables share the identical random secret. |
