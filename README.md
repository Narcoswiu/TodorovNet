<div align="center">

# 🏁 TodorovNET.API

**A real-time race-timing backend for hard enduro / off-road events**

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![ASP.NET Core](https://img.shields.io/badge/ASP.NET_Core-Web_API-512BD4?logo=dotnet&logoColor=white)](https://learn.microsoft.com/aspnet/core)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![EF Core](https://img.shields.io/badge/EF_Core-ORM-512BD4?logo=dotnet&logoColor=white)](https://learn.microsoft.com/ef/core/)
[![SignalR](https://img.shields.io/badge/SignalR-Real--time-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/apps/aspnet/signalr)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

</div>

---

A REST API + real-time backend for running hard enduro / off-road race events —
managing riders, race classes, live results, penalties, and multi-day event
schedules, with a live-updating public leaderboard powered by SignalR.

Built as a full end-to-end system: relational data model, JWT-secured admin
API, role-based access, CSV rider import, and a real-time public results
board — the kind of backend a small event-timing company would actually run
on race day.

## Features

- **Event management** — create/update events, track status and race flag
  (e.g. green/red/checkered) in real time
- **Riders** — CRUD per event, plus **CSV import** for bulk rider entry
- **Race classes** — configurable classes per event (laps, special stages,
  navigation, start groups) with riders assigned to classes
- **Multi-day schedule** — event days broken into segments (prologue, special
  stages, cross-country laps, etc.)
- **Live results & standings** — record results per rider/segment and compute
  standings on the fly, filterable by class
- **Penalties** — submit, confirm, or reject time/position penalties per rider
- **Contestations** — riders can raise a dispute against a penalty or result
- **Auth** — JWT-based login; a hardcoded super-admin (via config) plus a
  `Users` table for scoped roles (e.g. per-event timing staff)
- **Real-time updates** — a SignalR hub (`/hubs/race`) broadcasts live event
  updates to all connected clients grouped by event, so the public leaderboard
  updates without polling
- **Public results page** (`wwwroot/public.html`) and a full **admin panel**
  (`wwwroot/admin.html`) served as static files by the same API

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | .NET 10 / ASP.NET Core Web API |
| Database | PostgreSQL via Entity Framework Core (Npgsql) |
| Real-time | SignalR |
| Auth | JWT Bearer tokens |
| Frontend | Static HTML/CSS/JS admin panel + public results page (no build step) |

## Architecture

```
Controllers/   REST endpoints (Events, Riders, Classes, Schedule, Results,
               Penalties, Users, Auth, Import)
Models/        EF Core entities (Event, Rider, RaceClass, Result, Penalty,
               Contestation, EventDay/EventSegment, User)
Data/          AppDbContext + entity configuration
Hubs/          RaceHub — SignalR hub for live event broadcasts
Migrations/    EF Core migrations (schema history)
wwwroot/       Static admin panel + public leaderboard (served directly
               by the API, no separate frontend deployment needed)
```

## API overview

All endpoints are under `/api`. Most are scoped per event:
`/api/events/{eventId}/...`

| Resource | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` |
| Events | `GET/POST /api/events`, `GET/PUT/DELETE /api/events/{id}`, `PUT .../flag`, `PUT .../status`, `PATCH .../image` |
| Riders | `GET/POST /api/events/{eventId}/riders`, `GET/PUT/DELETE .../{id}` |
| Rider import | `POST /api/events/{eventId}/import/riders` (CSV upload) |
| Classes | `GET/POST /api/events/{eventId}/classes`, `POST .../{id}/riders`, `DELETE .../{id}/riders/{riderId}`, `POST .../seed`, `DELETE .../{id}` |
| Schedule | `GET /api/events/{eventId}/schedule`, `POST/DELETE .../days`, `POST/DELETE .../days/{dayId}/segments` |
| Results | `GET /api/events/{eventId}/results`, `GET .../standings`, `POST .../results`, `PUT .../rider/{raceNumber}/status` |
| Penalties | `GET/POST /api/events/{eventId}/penalties`, `PUT .../{id}/confirm`, `PUT .../{id}/reject`, `DELETE .../{id}` |
| Users (admin) | `GET/POST /api/users`, `PATCH .../{id}/password`, `PATCH .../{id}/active`, `DELETE .../{id}` |

Real-time: clients connect to the SignalR hub at `/hubs/race` and join an
event's group (`JoinEvent(eventId)`) to receive live updates for that event.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- PostgreSQL (local install or Docker)

## Getting started

1. Clone and enter the project:

   ```bash
   git clone https://github.com/YOUR_USERNAME/TodorovNET.API.git
   cd TodorovNET.API
   ```

2. Copy the example config and fill in your local values:

   ```bash
   cp appsettings.json.example appsettings.json
   ```

   ```jsonc
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Database=todorovnet;Username=YOUR_DB_USER;Password=YOUR_DB_PASSWORD;Timezone=UTC"
     },
     "Jwt": { "Key": "a-long-random-secret", "Issuer": "TodorovNET", "Audience": "TodorovNET" },
     "Admin": { "Username": "admin", "Password": "choose-a-strong-password" }
   }
   ```

3. Make sure PostgreSQL is running and the database/user in your connection
   string exist, e.g.:

   ```bash
   createdb todorovnet
   ```

4. Apply migrations:

   ```bash
   dotnet ef database update
   ```

5. Run the API:

   ```bash
   dotnet run
   ```

   The console prints the listening URL (e.g. `http://localhost:5048`).

## Trying it out

- Public leaderboard: `http://localhost:5048/public.html`
- Admin panel: `http://localhost:5048/admin.html` — log in with the
  `Admin:Username` / `Admin:Password` from your `appsettings.json`
- Raw API: e.g. `GET http://localhost:5048/api/events`

The admin/public pages call the API at `window.location.origin + '/api'`, so
they work unmodified whether you run locally or deploy to a real domain.

## Notes on design decisions

- **Config-driven super-admin + DB-backed users**: the single super-admin
  account lives in config rather than the database, so the very first login
  never depends on data already existing in a fresh database. Additional
  scoped users (e.g. per-event timing staff) are created afterwards through
  the `Users` API.
- **Enum-to-string conversion**: enums (event status, rider license status,
  penalty type, etc.) are stored as strings in PostgreSQL rather than
  integers, so the raw data stays human-readable when inspected directly in
  the database.
- **Event-scoped routes**: most resources are nested under `/api/events/{id}`
  because almost every entity in the domain (riders, classes, results,
  penalties, schedule) only makes sense in the context of a specific event.

## Known limitations / possible next steps

- No automated tests yet
- `appsettings.json` is git-ignored by design (see below) — a
  production deployment should use environment variables or a secrets
  manager instead of a committed file
- CORS is currently wide open (`AllowAnyOrigin`) for local development
  convenience; should be locked down to the real frontend origin(s) in
  production

## Security

`appsettings.json` is intentionally excluded from version control (see
`.gitignore`) because it holds the database password, JWT signing key, and
admin password. Use `appsettings.json.example` as a template and never commit
real secrets.

## License

MIT — see [LICENSE](LICENSE).
