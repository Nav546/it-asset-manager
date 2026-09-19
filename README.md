# IT Asset & Incident Manager

A containerised full-stack app for tracking IT assets and helpdesk tickets. Four services run together with Docker Compose.

## Tech stack

- **Frontend:** React (Vite), served by nginx
- **Backend:** Node.js + Express, JWT authentication, bcrypt password hashing
- **Database:** PostgreSQL 16
- **Cache:** Redis 7 (caches the asset list for 30 seconds)
- **Orchestration:** Docker Compose with health checks and an isolated network

## Architecture

```
Browser -> nginx (:8080) -> /api/* -> Express backend (:5000) -> PostgreSQL + Redis
```

nginx serves the built React app and reverse-proxies `/api/` requests to the backend. The backend only starts once the database and Redis report healthy. Data lives in a named Docker volume, so it survives container restarts.

## Run it

Requires Docker Desktop.

```
git clone https://github.com/Nav546/it-asset-manager.git
cd it-asset-manager
copy .env.example .env
docker compose up --build
```

Edit `.env` and change the placeholder password and JWT secret before using this anywhere real.

Open http://127.0.0.1:8080. On Windows, `127.0.0.1` worked when `localhost` did not.

Create the first user (PowerShell), then log in through the UI:

```
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8080/api/auth/register -ContentType "application/json" -Body '{"username":"admin","password":"choose-a-password","role":"admin"}'
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create a user |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET / POST | `/api/assets` | List (cached in Redis) / add an asset |
| PUT / DELETE | `/api/assets/:id` | Update / delete an asset |
| GET / POST | `/api/tickets` | List (optional `?status=`) / create a ticket |
| PUT | `/api/tickets/:id` | Update ticket status or details |
| GET | `/api/health` | Checks database and Redis connectivity |

All asset and ticket routes require a valid JWT.

## Known limitations and next steps

- Registration is open and accepts a `role` field. It should be restricted so only admins can create admins.
- The UI does not display API errors, so failed requests fail silently.
- The RAM field accepts numbers only (no units).
- The login session does not survive a page refresh.
- PostgreSQL and Redis ports are published to the host for convenience. In a real deployment only the frontend port should be exposed.
- Next: deploy to Azure (Container Apps and Azure Database for PostgreSQL) and add a CI/CD pipeline.