# MailPulse - Distributed Email Scheduling & Delivery Platform

MailPulse is a distributed, production-oriented email scheduling and delivery system designed to handle high-throughput email campaigns without relying on cron jobs or in-memory timers.

- **Durable Scheduling**: BullMQ + Redis delayed jobs (`delay = scheduledAt - Date.now()`) with AOF persistence surviving server restarts.
- **Relational Integrity**: PostgreSQL + Prisma managing `User`, `Sender`, `Campaign`, and `Email` states (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`).
- **Distributed Coordination**: Atomic hourly rate limiting (`email-rate:${senderId}:${hour}`) and cross-worker minimum send delay coordination (`mailpulse:last_send_timestamp`).
- **High-Performance Search**: Elasticsearch (`mailpulse-emails`) index with user tenant isolation.
- **Real SMTP Dispatch**: Automatic Ethereal test inbox provisioning per sender.
- **Authentication**: Production Google OAuth 2.0 (via `google-auth-library` and HTTP-only session cookies) + Evaluator Demo Login bypass for zero-config local testing.

---

## Google OAuth 2.0 Setup Guide

MailPulse utilizes official Google OAuth 2.0 for user authentication. Follow these exact steps in Google Cloud Console:

### 1. Create a Google Cloud Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one (e.g. `MailPulse-Prod`).

### 2. Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace) and click **Create**.
3. Enter Application Name: `MailPulse`.
4. Enter User Support Email and Developer Contact Information.
5. In the **Scopes** step, add the following scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Under **Test users**, add your own Google email address (if project is in Testing mode).
7. Save and continue.

### 3. Create OAuth 2.0 Client Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Application type**: **Web application**.
4. Set Name: `MailPulse Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173`
   - `http://localhost:5000`
6. Under **Authorized redirect URIs**, add the exact backend callback URL:
   ```text
   http://localhost:5000/api/auth/google/callback
   ```
   > [!IMPORTANT]
   > The redirect URI MUST be `http://localhost:5000/api/auth/google/callback`. MailPulse routes the Google authorization code through the backend API running on port `5000` at route `/api/auth/google/callback`.
7. Click **Create**. A dialog will display your **Client ID** and **Client Secret**.

### 4. Configure `backend/.env`
Paste the generated credentials into [`backend/.env`](backend/.env):

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=a_strong_random_32_byte_secret_string
```

---

## Development / Evaluator Demo Login Bypass

For reviewers who want to evaluate the platform immediately without creating a Google Cloud project:
- The login page includes a clearly demarcated **Developer & Evaluator Bypass** (`Launch Evaluator Demo Session`).
- This creates an isolated evaluator session with zero external dependencies, allowing instant access to the dashboard, scheduled tables, campaign compose modal, and live Bull Board monitoring.

---

## Running the Application

### 1. Start Infrastructure (PostgreSQL, Redis, Elasticsearch)
```bash
docker compose up -d
```

### 2. Push Database Schema
```bash
cd backend
npx prisma db push
```

### 3. Start Backend API (Port 5000)
```bash
cd backend
npm run dev
```

### 4. Start BullMQ Queue Worker
```bash
cd backend
npm run worker
```

### 5. Start Frontend UI (Port 5173)
```bash
cd frontend
npm run dev
```

### 6. Run Test Suite
```bash
cd backend
npm test
```
