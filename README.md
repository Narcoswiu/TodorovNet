# TodorovNET.API

ASP.NET Core Web API (.NET 10) with PostgreSQL, EF Core, JWT auth and SignalR.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- PostgreSQL (local install or Docker)

## Setup

1. Copy `appsettings.json.example` to `appsettings.json` and fill in real values:

   ```bash
   cp appsettings.json.example appsettings.json
   ```

2. Make sure PostgreSQL is running and the database/user from your connection string exist.

3. Apply migrations:

   ```bash
   dotnet ef database update
   ```

4. Run the API:

   ```bash
   dotnet run
   ```

## Notes

- `appsettings.json` is git-ignored on purpose (contains secrets). Never commit real secrets.
