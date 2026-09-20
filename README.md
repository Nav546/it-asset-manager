# Enterprise IT Incident & Asset Management System

A microservice-based web portal for IT Support / System Engineers to track hardware assets,
log service desk tickets, and monitor system health — built as a 4-container Docker Compose stack.

## Architecture

| Layer        | Technology        | Docker Role                                      |
|--------------|--------------------|--------------------------------------------------|
| Frontend     | React (Vite)       | Built and served via an Nginx reverse proxy       |
| Backend API  | Node.js (Express)  | REST API — auth, tickets, asset management        |
| Database     | PostgreSQL          | Persistent volume for users, tickets, inventory    |
| Cache        | Redis               | Caches asset list queries for faster reads         |

## Prerequisites

- Docker Desktop installed and running
- Ports 8080, 5432, 6379 free on your machine

## Setup

1. Copy the example env file and fill in real values:
   ```bash
   cp .env.example .env
   ```

2. Build and start all 4 services:
   ```bash
   docker compose up --build
   ```

3. Wait for all services to report healthy (Postgres and Redis have health checks;
   the backend waits on both before starting).

4. Open the app: **http://localhost:8080**

5. Register a user via the API first (no signup UI yet):
   ```bash
   curl -X POST http://localhost:8080/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"naveen","password":"testpass123","role":"admin"}'
   ```
   Then log in through the UI with those credentials.

## Useful commands

```bash
docker compose ps              # check status of all 4 services
docker compose logs backend    # view backend logs
docker compose down            # stop everything (keeps data volume)
docker compose down -v         # stop everything AND wipe the database volume
```

## API Endpoints

| Method | Endpoint              | Description                      |
|--------|------------------------|-----------------------------------|
| POST   | /api/auth/register     | Create a user                     |
| POST   | /api/auth/login        | Log in, returns a JWT             |
| GET    | /api/assets            | List all assets (cached in Redis) |
| POST   | /api/assets            | Log a new device                  |
| PUT    | /api/assets/:id        | Update / reassign a device        |
| DELETE | /api/assets/:id        | Remove a device                   |
| GET    | /api/tickets           | List tickets (optional ?status=)  |
| POST   | /api/tickets            | Create an incident ticket         |
| PUT    | /api/tickets/:id        | Update ticket status/details      |
| GET    | /api/health            | Health check (DB + Redis)         |

## Project Structure

```
it-asset-manager/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   └── src/
│       ├── db.js
│       ├── redisClient.js
│       ├── middleware/auth.js
│       └── routes/{auth,assets,tickets}.js
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/{main.jsx, App.jsx, api.js}
└── database/
    └── init.sql
```
