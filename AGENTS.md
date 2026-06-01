# AGENTS.md — webmail/ (Bulwark Webmail)

## Project Overview

Bulwark is a modern webmail client built with Next.js and the JMAP protocol, designed for use with the Stalwart mail server. It is the webmail UI deployed at `webmail.bieszczadzka24.pl` in the `mail-archive` namespace.

- **Version:** 1.7.2
- **Stack:** Next.js 16 + React 19 + TypeScript + TailwindCSS + Zustand
- **License:** AGPL-3.0-only
- **Source:** forked from [github.com/bulwarkmail/webmail](https://github.com/bulwarkmail/webmail)

## Architecture

```
Browser ──► Bulwark (Next.js :3000)
               │
               ├── Client-side JMAP  ──► Stalwart :8080 (browser → /jmap, /api/*)
               │
               └── Server-side proxy ──► Stalwart :8080 (Next.js API routes for auth, account mgmt)
```

In production, an nginx sidecar sits in front — routing `/jmap`, `/admin`, `/login`, `/authorize`, `/auth/token`, and specific `/api/*` paths to Stalwart, with everything else going to Next.js. In local dev (docker-compose.mail.yml), Bulwark connects directly to Stalwart over Docker networking — no nginx.

## Development Commands

### Local dev (standalone, mock JMAP)
```bash
cp .env.dev.example .env.local
npm run dev              # Dev server :3000 with built-in mock JMAP
                         # Login with any username/password
```

### Local dev (with Stalwart)
```bash
# From monorepo root:
docker compose -f docker-compose.mail.yml up -d
# Then open http://localhost:3000
```

### Build
```bash
npm run build            # Production build (turbopack)
npm run start            # Start production server
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
```

### Testing
```bash
npm run test:translations    # Vitest translation tests
```

## Environment Variables

Key variables for Stalwart integration:

| Variable | Required | Description |
|----------|----------|-------------|
| `JMAP_SERVER_URL` | Yes | URL of the JMAP server. In Docker Compose: `http://stalwart:8080`. In production: `https://webmail.bieszczadzka24.pl` (hairpins through CF tunnel). |
| `STALWART_FEATURES` | No | Enable Stalwart-specific features (password change, sieve filters, etc.). Default `false`. |
| `SESSION_SECRET` | For remember-me | Secret key for encrypting sessions. Generate with `openssl rand -base64 32`. |
| `SETTINGS_SYNC_ENABLED` | No | Enable server-side settings persistence. Requires `SESSION_SECRET`. |
| `APP_NAME` | No | App name shown in UI and browser tab. |
| `HOSTNAME` | No | Bind address (default `0.0.0.0`). |
| `PORT` | No | Bind port (default `3000`). |

See `.env.example` for full reference (branding, OAuth, telemetry, etc.).

## Docker

The Dockerfile uses a multi-stage build:
1. `node:24-alpine` builder — `npm ci` + `npx next build --webpack`
2. `node:24-alpine` runner — standalone Next.js server

Volumes:
- `/app/data/settings` — encrypted user settings
- `/app/data/admin` — admin config, plugins, themes, branding (can be `:ro` after setup wizard)
- `/app/data/admin-state` — admin runtime state (always read-write)
- `/app/data/telemetry` — anonymous telemetry state

## CI/CD

- **GitHub Actions** — `.github/workflows/build-webmail.yml` builds and pushes to `ghcr.io/exigo996/webmail:latest` on push to `main` (path-filtered to `webmail/` changes). Also tagged with `sha-<short>`.
- **Terraform** — `infra/modules/bulwark/` uses the custom image via `var.image` (default: `ghcr.io/exigo996/webmail:latest`). Requires `ghcr_username`/`ghcr_password` in tfvars for `imagePullSecrets`.
- **Manual deploy** — `docker compose -f docker-compose.mail.yml build webmail` for local testing.

## Key Gotchas

- **Production nginx routing is complex** — see `gazeta-email-scraper/AGENTS.md` for the full routing table. Stalwart and Bulwark share the same origin, and their `/api/*` namespaces collide. Nginx uses longest-prefix matching.
- **JMAP_SERVER_URL must be the public domain in production** — server-side API routes hairpin through Cloudflare → tunnel → nginx → Stalwart. In local dev it's the internal Docker hostname.
- **Basic auth popup loop after password change** — Stalwart returns `WWW-Authenticate: Basic` on 401, which triggers a native browser dialog that loops forever. The fix is `proxy_hide_header WWW-Authenticate` in nginx. After any password change, the user MUST re-login.
- **`/api/auth/stalwart-context` is critical** — this route writes an httpOnly cookie holding the user's basic-auth header for server-side JMAP passthrough. If nginx shadows it (proxying to Stalwart instead of Next.js), all account management silently breaks.
- **Stalwart permissions** — `x:AccountPassword/set` and friends need "Manage account passwords" + "Modify user account information" enabled in Stalwart WebAdmin for the user principal.
- **No `updateBasicAuth()` after password change** — Bulwark doesn't call this internally, so the live JMAP client keeps stale credentials. Users must log out and back in. (Not fixable without forking AGPL code.)
- **Build-time variables** — `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `GIT_COMMIT` are baked in at Docker build time via `ARG`. Changing them requires a rebuild.
- **`next build --webpack` in Docker** — the Dockerfile uses webpack, not turbopack, for production builds. Local `npm run build` uses turbopack.
