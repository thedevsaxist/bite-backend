# Calorie Estimation API

Backend for the calorie-estimation Flutter app. Built with Express 5, TypeScript, SQLite and Drizzle ORM.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the secrets
npm run db:migrate     # create the tables
npm run db:seed        # load the nutritional reference data
npm run dev            # http://localhost:4000/api/v1/health
```

## Scripts

| Script                | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `npm run dev`         | Start the server with live reload (tsx watch)               |
| `npm run build`       | Compile TypeScript to `dist/`                               |
| `npm start`           | Run the compiled server                                     |
| `npm test`            | Run the test suite (Vitest + Supertest)                     |
| `npm run typecheck`   | Type-check without emitting                                 |
| `npm run lint`        | Lint with ESLint                                            |
| `npm run format`      | Format with Prettier                                        |
| `npm run db:generate` | Generate a SQL migration from changes in `src/db/schema/`   |
| `npm run db:migrate`  | Apply pending migrations to the database                    |
| `npm run db:seed`     | Load or update the nutritional reference data (re-runnable) |
| `npm run db:studio`   | Open Drizzle Studio to browse the database                  |

## Project structure

```
src/
├── app.ts               # Builds the Express app (middleware + routes), no listen()
├── server.ts            # Entry point: starts the HTTP server, graceful shutdown
├── config/
│   ├── env.ts           # Environment variables, validated with Zod at startup
│   └── logger.ts        # Pino logger
├── db/
│   ├── index.ts         # SQLite connection + Drizzle client
│   ├── migrate.ts       # Applies migrations from ./drizzle
│   └── schema/          # Table definitions (one file per feature)
├── integrations/
│   └── ai/              # Contract for the external food-recognition model + its providers
├── middlewares/         # Error handler, 404, request validation, rate limiting, auth
├── modules/             # One folder per feature
│   ├── health/          # Health check
│   ├── auth/            # Email/password, Google and Apple sign-in, tokens
│   ├── users/           # Current user
│   ├── profile/         # Profile and daily calorie reference        (planned)
│   ├── settings/        # App preferences, e.g. auto-save            (planned)
│   ├── nutrition/       # Nutritional reference data                 (planned)
│   ├── analyses/        # Image upload, AI recognition, estimates    (planned)
│   ├── meals/           # Meal records (food-intake history)         (planned)
│   └── summary/         # Intake totals vs daily reference           (planned)
├── routes/index.ts      # Mounts every module router under /api/v1
└── utils/               # AppError, response helpers
tests/                   # Vitest + Supertest integration tests
evaluation/              # Recognition and calorie-estimation evaluation (planned)
docs/ROADMAP.md          # Build stages and what each one covers
drizzle/                 # Generated SQL migrations (committed)
data/                    # SQLite database file (git-ignored)
uploads/                 # Uploaded meal images (git-ignored)
```

Planned modules only have a `*.routes.ts` stub listing their endpoints so far. See
[docs/ROADMAP.md](docs/ROADMAP.md) for the build order.

Each feature module follows the same layering:

- **routes**: URL + HTTP method → middleware chain (validation, auth) → controller
- **controller**: reads the request, calls the service, sends the response
- **service**: business logic; knows nothing about Express
- **repository**: database queries with Drizzle
- **schemas**: Zod schemas for request validation and their inferred types

## API conventions

- Base path: `/api/v1`
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }`
- Protected routes need `Authorization: Bearer <accessToken>`.

## Endpoints

| Method | Path                         | Auth | Body                                  |
| ------ | ---------------------------- | ---- | ------------------------------------- |
| GET    | `/health`                    |      |                                       |
| POST   | `/auth/register`             |      | `{ email, password, name? }`          |
| POST   | `/auth/login`                |      | `{ email, password }`                 |
| POST   | `/auth/google`               |      | `{ idToken }`                         |
| POST   | `/auth/apple`                |      | `{ idToken, nonce?, name? }`          |
| POST   | `/auth/refresh`              |      | `{ refreshToken }`                    |
| POST   | `/auth/logout`               |      | `{ refreshToken }` → `204 No Content` |
| GET    | `/users/me`                  | ✓    |                                       |
| GET    | `/profile`                   | ✓    |                                       |
| PUT    | `/profile`                   | ✓    | full profile (see below)              |
| PATCH  | `/profile`                   | ✓    | any subset of the profile fields      |
| GET    | `/profile/dietary-reference` | ✓    |                                       |
| GET    | `/settings`                  | ✓    |                                       |
| PATCH  | `/settings`                  | ✓    | `{ autoSaveResults }`                 |

Register, login, Google and Apple all return:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "hasPassword": true,
    "accountStatus": "active",
    "createdAt": "..."
  },
  "tokens": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresIn": 900
  },
  "isNewUser": true
}
```

`isNewUser` is `true` when the account was just created, so the app can send the user to profile setup.

### Profile and daily calorie reference

`PUT /profile` body (all fields required; `PATCH` accepts any subset once a profile exists):

```json
{
  "age": 30,
  "sex": "male",
  "weightKg": 80,
  "heightCm": 180,
  "activityLevel": "moderate",
  "weightGoal": "maintain"
}
```

- `sex`: `male` | `female` · `age`: 18–120 · `weightKg`: 20–500 · `heightCm`: 50–275
- `activityLevel`: `sedentary` | `light` | `moderate` | `active` | `very_active`
- `weightGoal`: `lose` | `maintain` | `gain`

`PUT` and `PATCH` return `{ profile, dietaryReference }`, where `dietaryReference` is
`{ dailyCalorieReference, bmr, maintenanceCalories, calculatedAt }`. The reference is the
Mifflin–St Jeor BMR × an activity factor, −500 / 0 / +500 kcal for the goal, and never below
1500 (male) / 1200 (female) kcal unless maintenance is lower. It is a basic estimate, not dietary advice.

Until the profile is set up, the profile endpoints return `404` with code `PROFILE_NOT_FOUND`.
Settings need no setup: `GET /settings` returns the defaults (`autoSaveResults: true`).

### Nutritional reference data

Reference foods live in `src/db/seeds/nutrition-references.ts` (all values per 100 g) and are loaded with
`npm run db:seed`, which updates existing rows by `key`, so edit the file and re-run it to correct a value.
Each food has a typical serving (e.g. jollof rice: 300 g, "1 plate") so a portion of "1 serving" can be
converted to grams. Calorie estimates use `Cᵢ = Sᵢ × Cₛ` per item and `C_meal = Σ Cᵢ` per meal
(`src/modules/nutrition/calorie-calculator.ts`). Nigerian dishes are marked as approximate in their `source`
until checked against the FAO/INFOODS West African Food Composition Table (2019).

### Session handling (for the mobile app)

- The **access token** is a JWT valid for 15 minutes. When it expires, protected routes return
  `401` with error code `TOKEN_EXPIRED`.
- Exchange the **refresh token** (valid 30 days) at `/auth/refresh` for a new access token _and_ a new
  refresh token. Always store the new refresh token; the old one stops working.
- Reusing an old refresh token is treated as theft and signs the user out everywhere
  (`INVALID_REFRESH_TOKEN`). So only run **one refresh at a time**: if several requests get
  `TOKEN_EXPIRED` together, refresh once and retry them all with the new token.
- `INVALID_REFRESH_TOKEN` from `/auth/refresh` means the session is over: send the user to sign-in.

### Social sign-in

The app signs in with Google (`google_sign_in`) or Apple (`sign_in_with_apple`) itself and sends the
resulting ID token here; the server verifies it against Google's/Apple's public keys. Set
`GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` in `.env`, otherwise the endpoint returns `503`.
A social sign-in with the same verified email as an existing account is linked to that account.
