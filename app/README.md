# RecipeShare application

Next.js App Router application with MySQL, Drizzle ORM, and password authentication.

## Local development

Start Docker Desktop, then run from the repository root:

```powershell
docker compose up -d --wait mysql
cd app
pnpm.cmd install
pnpm.cmd dev --port 3000
```

Create `.env.local` with the runtime database credentials:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=recipeshare
DB_USER=recipe_app
DB_PASSWORD="<runtime-password>"
```

Use `.env.migration.local` for the migration account:

```dotenv
MIGRATION_DB_HOST=127.0.0.1
MIGRATION_DB_PORT=3307
MIGRATION_DB_NAME=recipeshare
MIGRATION_DB_USER=recipe_owner
MIGRATION_DB_PASSWORD="<migration-password>"
```

Both environment files are ignored by Git. Apply migrations before using the API:

```powershell
pnpm.cmd exec drizzle-kit migrate
```

## Authentication API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /api/auth/register | Register with username, displayName, password, and email or phone |
| POST | /api/auth/login | Sign in with identifier and password |
| GET | /api/auth/me | Read the current authenticated user |
| POST | /api/auth/logout | Revoke the current session and clear its cookie |
| GET | /api/health/db | Check database access and the starter title |

Login accepts a username, email address, or international phone number as identifier.
Passwords use scrypt. Session cookies contain a random token; MySQL stores its SHA-256 hash.
Sessions expire after seven days. Cookies are HttpOnly, SameSite=Lax, and Secure in production.
Production requires HTTPS. Authentication responses and validation messages use English.

The official frontend is still the Next.js scaffold. The existing UI prototype is in ../demo-ui/.

## Checks

```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd lint
node scripts/test-validation.mjs
node scripts/test-login.mjs
node --conditions=react-server scripts/test-password.mjs
```

The scripts cover validation, identifier normalization, and password hashing.
Verify the API session lifecycle separately: login, read /me, logout, then replay the old cookie.
The replay must return HTTP 401. Never paste session cookies or database passwords into reports.