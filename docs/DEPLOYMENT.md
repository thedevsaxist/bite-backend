# Requirements and deployment

What the backend needs to run (report §4.1) and how to deploy it.

## Software requirements

### Runtime

| Component        | Version / choice                       | Purpose                                           |
| ---------------- | -------------------------------------- | ------------------------------------------------- |
| Node.js          | 22 or later (developed on 26.9)        | Runs the server                                   |
| npm              | 10 or later (developed on 11.19)       | Installs dependencies, runs scripts               |
| SQLite           | bundled with `better-sqlite3` 13       | Database (a single file, `data/app.db`)           |
| libvips          | bundled with `sharp` 0.35              | Photo validation, resizing, blur check            |
| Operating system | Linux, macOS or Windows (x64 or arm64) | Anything Node.js and the bundled binaries support |

### Main libraries

| Library                                     | Purpose                                          |
| ------------------------------------------- | ------------------------------------------------ |
| Express 5                                   | HTTP API                                         |
| TypeScript 6                                | Language (compiled to JavaScript for production) |
| Drizzle ORM                                 | Database access and migrations                   |
| Zod 4                                       | Request validation, AI response validation       |
| jose, argon2                                | Tokens (JWT) and password hashing                |
| multer, sharp                               | Photo upload and processing                      |
| @google/genai 2.27, @anthropic-ai/sdk 0.131 | Gemini and Claude food recognition               |
| @supabase/supabase-js 2.117                 | Photo storage                                    |
| helmet, express-rate-limit, pino            | Security headers, rate limits, logging           |
| Vitest, Supertest, ESLint, Prettier         | Tests and code quality (development only)        |

### External services

| Service                                   | Required?                                | Used for                                 |
| ----------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Google Gemini API or Anthropic Claude API | Yes                                      | Recognising foods and portions in photos |
| Supabase Storage (private bucket)         | Yes for production; local disk otherwise | Storing meal photos                      |
| Google / Apple sign-in, or Firebase Auth  | Optional                                 | Social sign-in                           |

The server needs outbound HTTPS to these services. The mobile app needs internet access to reach the
server (report §1.6, system-level limitations).

## Hardware requirements

### Development machine

Developed and tested on a MacBook Air (Apple M3, 16 GB RAM, macOS 27). Any machine that runs Node.js 22
with about 2 GB of free RAM and 1 GB of disk for dependencies is enough.

### Server

| Resource | Minimum | Recommended | Why                                                               |
| -------- | ------- | ----------- | ----------------------------------------------------------------- |
| CPU      | 1 vCPU  | 2 vCPU      | Photo processing (decode, resize, blur check) is CPU work         |
| RAM      | 512 MB  | 1 GB        | Photos are processed in memory (up to 10 MB / 40 megapixels each) |
| Disk     | 1 GB    | 5 GB        | Code, dependencies and the database; photos are in Supabase       |
| Network  | HTTPS   | HTTPS       | Tokens and photos must not travel unencrypted                     |

The AI model runs on Google's or Anthropic's servers, so the backend needs no GPU. An analysis takes
several seconds, almost all of it waiting for the AI service (about 14 s observed with
`gemini-3.5-flash-lite` at medium effort); measure it properly with `npm run evaluate`.

### Mobile device

A smartphone with a camera and internet access, running the Flutter app.

## Deploying

1. **Install and build**

   ```bash
   npm ci
   npm run build          # compiles src/ to dist/
   ```

2. **Configure** `.env` (see `.env.example`). For production at least:

   | Variable                                                       | Value                                                             |
   | -------------------------------------------------------------- | ----------------------------------------------------------------- |
   | `NODE_ENV`                                                     | `production` (hides internal error messages)                      |
   | `JWT_ACCESS_SECRET`                                            | A new random 64-byte hex string, never the example                |
   | `DATABASE_URL`                                                 | A path on a persistent disk                                       |
   | `STORAGE_DRIVER`, `SUPABASE_*`                                 | `supabase`, the project URL, secret key and bucket                |
   | `AI_PROVIDER` and its key                                      | `gemini` + `GEMINI_API_KEY`, or `anthropic` + `ANTHROPIC_API_KEY` |
   | `CORS_ORIGIN`                                                  | Only matters for web clients                                      |
   | `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`, `FIREBASE_PROJECT_ID` | For social sign-in, if used                                       |

3. **Load the nutrition data** (once, and again after editing it):

   ```bash
   node dist/db/seed.js
   ```

   Migrations run automatically when the server starts.

4. **Start**

   ```bash
   node dist/server.js
   ```

   Run it under a process manager (systemd, pm2) or a hosting platform so it restarts after a crash.
   It shuts down cleanly on `SIGTERM`. Analyses interrupted by a restart are marked failed
   (`INTERRUPTED`) when it starts again.

5. **Put HTTPS in front**: a reverse proxy (Nginx, Caddy) or the platform's load balancer. The app
   trusts one proxy hop, so rate limits see the real client IP.

6. **Check it**: `GET /api/v1/health` returns `200`. Point the platform's health check at it.

### Hosting notes

- The database is one SQLite file, so the server must run as **one instance** with the file on a
  **persistent disk or volume**. Platforms that wipe the disk on each deploy lose every account
  otherwise.
- **Back up** the database file regularly, e.g. `sqlite3 data/app.db ".backup backup.db"` while
  running, or copy the file while the server is stopped. Photos are in Supabase and need no backup
  here.
- Keep `.env` out of version control; it holds the JWT secret and the AI and Supabase keys.
