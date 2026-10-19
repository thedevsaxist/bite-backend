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

| Script                | What it does                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `npm run dev`         | Start the server with live reload (tsx watch)                      |
| `npm run build`       | Compile TypeScript to `dist/`                                      |
| `npm start`           | Run the compiled server                                            |
| `npm test`            | Run the test suite (Vitest + Supertest)                            |
| `npm run typecheck`   | Type-check without emitting                                        |
| `npm run lint`        | Lint with ESLint                                                   |
| `npm run format`      | Format with Prettier                                               |
| `npm run db:generate` | Generate a SQL migration from changes in `src/db/schema/`          |
| `npm run db:migrate`  | Apply pending migrations to the database                           |
| `npm run db:seed`     | Load or update the nutritional reference data (re-runnable)        |
| `npm run evaluate`    | Run the evaluation on the labelled test photos (see `evaluation/`) |
| `npm run db:studio`   | Open Drizzle Studio to browse the database                         |

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
│   ├── ai/              # Food recognition: provider interface, prompt + schema, Claude and Gemini
│   └── storage/         # Photo storage: local folder or Supabase Storage
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
├── evaluation/          # npm run evaluate: metrics and report for the labelled test photos
├── routes/index.ts      # Mounts every module router under /api/v1
└── utils/               # AppError, response helpers
tests/                   # Vitest + Supertest integration tests
evaluation/              # Test photos + labels for the evaluation (code in src/evaluation/)
docs/ROADMAP.md          # Build stages and what each one covers
drizzle/                 # Generated SQL migrations (committed)
data/                    # SQLite database file (git-ignored)
uploads/                 # Meal photos when STORAGE_DRIVER=local (git-ignored)
```

Planned modules only have a `*.routes.ts` stub listing their endpoints so far. See
[docs/ROADMAP.md](docs/ROADMAP.md) for the build order.

Each feature module follows the same layering:

- **routes**: URL + HTTP method → middleware chain (validation, auth) → controller
- **controller**: reads the request, calls the service, sends the response
- **service**: business logic; knows nothing about Express
- **repository**: database queries with Drizzle
- **schemas**: Zod schemas for request validation and their inferred types

## API reference

The full API is described in [docs/openapi.yaml](docs/openapi.yaml) (OpenAPI 3.1): every endpoint,
request and response shape and error code. Import it into Postman, Insomnia or Swagger UI, or generate a
Dart client from it. A test checks it lists exactly the routes the code implements.
Deployment and the hardware/software requirements are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## API conventions

- Base path: `/api/v1`
- Success: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": ... } }`
- Protected routes need `Authorization: Bearer <accessToken>`. A deleted or suspended account gets
  `401 ACCOUNT_UNAVAILABLE` at once, even with an unexpired token.

## Endpoints

| Method | Path                         | Auth | Body                                  |
| ------ | ---------------------------- | ---- | ------------------------------------- |
| GET    | `/health`                    |      |                                       |
| POST   | `/auth/register`             |      | `{ email, password, name? }`          |
| POST   | `/auth/login`                |      | `{ email, password }`                 |
| POST   | `/auth/google`               |      | `{ idToken }`                         |
| POST   | `/auth/apple`                |      | `{ idToken, nonce?, name? }`          |
| POST   | `/auth/firebase`             |      | `{ idToken, name? }`                  |
| POST   | `/auth/refresh`              |      | `{ refreshToken }`                    |
| POST   | `/auth/logout`               |      | `{ refreshToken }` → `204 No Content` |
| GET    | `/users/me`                  | ✓    |                                       |
| GET    | `/profile`                   | ✓    |                                       |
| PUT    | `/profile`                   | ✓    | full profile (see below)              |
| PATCH  | `/profile`                   | ✓    | any subset of the profile fields      |
| GET    | `/profile/dietary-reference` | ✓    |                                       |
| GET    | `/settings`                  | ✓    |                                       |
| PATCH  | `/settings`                  | ✓    | `{ autoSaveResults }`                 |

Register, login, Google, Apple and Firebase all return:

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

### Meal photos

Meal photos are sent as `multipart/form-data` in a field named `image` (the endpoint arrives with the
analysis pipeline). The server checks the actual file contents, so the app can send any content type.
A photo is rejected when it is:

| Problem                                | Status | Error code               |
| -------------------------------------- | ------ | ------------------------ |
| Missing                                | 400    | `IMAGE_REQUIRED`         |
| Over `MAX_UPLOAD_SIZE_MB` (default 10) | 413    | `LIMIT_FILE_SIZE`        |
| Not an image, or corrupt               | 400    | `INVALID_IMAGE`          |
| Not JPEG, PNG or WebP (e.g. HEIC, GIF) | 415    | `UNSUPPORTED_IMAGE_TYPE` |
| Over 40 megapixels                     | 413    | `IMAGE_TOO_LARGE`        |
| Under 256 px on its shorter side       | 422    | `IMAGE_TOO_SMALL`        |
| Blurry or blank                        | 422    | `IMAGE_TOO_BLURRY`       |

iPhone photos are HEIC by default, so have the app hand over JPEG (with `image_picker`, setting
`imageQuality` makes it re-encode to JPEG).

Accepted photos are turned upright, scaled down to at most 1568 px on the long side (never scaled up),
converted to JPEG and stripped of all metadata, including GPS location, before they are stored or sent
to the AI model. The blur check scores sharpness as the variance of the Laplacian at 512 px; sharp food
photos scored 180–1340 in calibration and strongly blurred ones under 20, so the default
`IMAGE_BLUR_THRESHOLD` is 30.

#### Where photos are stored

`STORAGE_DRIVER` picks the storage. Either way, photos are saved as `<userId>/<uuid>.jpg` and only
that path goes in the database, so switching storage needs no migration.

- `supabase`: a **private** Supabase Storage bucket (`SUPABASE_STORAGE_BUCKET`, default `meal-images`).
  The server uses the secret key (`SUPABASE_SECRET_KEY`), so the bucket needs no access policies. The
  app never talks to Supabase: the API gives it signed links valid for `SIGNED_URL_TTL_SECONDS`
  (default 1 hour). The server refuses to start if the URL or key is missing.
- `local` (default): files under `UPLOAD_DIR`. Signed links aren't available, so the API serves the
  photo itself. Tests always use this.

Storage failures return `503` with code `STORAGE_UNAVAILABLE`.

### Food analyses

`POST /analyses` analyses a meal photo. Send `multipart/form-data` with the photo in `image` and,
optionally, meal notes in `context` (up to 1000 characters, e.g. "half a plate, fried in palm oil").
The server validates the photo, stores it, asks Claude what is on the plate, matches each item to a
reference food, calculates the nutrients and returns the stored analysis (`201`, same shape as below).
It takes a few seconds, so show a loading state. Each user can start 30 analyses per 15 minutes.

- A matched food without a weight estimate is counted as one typical serving (`unit: "serving"`).
- If the photo shows no food, the response is `422 NO_FOOD_DETECTED`.
- When the AI step fails, the error says why (see Food recognition below) and the failed analysis is
  still stored. Its id is in `error.details.analysisId`.
- Photo problems (blurry, too small, …) are rejected before anything is stored.

`GET /analyses/:id` returns one analysis of one photo, exactly as the AI produced it. Corrections the
user makes later are stored as a separate meal record, so this never changes.

```json
{
  "analysis": {
    "id": "...",
    "status": "completed",
    "additionalContext": "Lunch, cooked with palm oil",
    "imageUrl": "https://<project>.supabase.co/storage/v1/object/sign/...",
    "items": [
      {
        "id": "...",
        "name": "jollof rice",
        "nutritionReference": { "id": "...", "key": "jollof_rice", "name": "Jollof rice" },
        "portion": { "description": "1 plate", "quantity": 300, "unit": "g" },
        "confidence": 0.92,
        "nutrients": { "calories": 495, "protein": 9, "carbohydrates": 81, "fat": 15 }
      },
      {
        "name": "zobo drink",
        "nutritionReference": null,
        "nutrients": null
      }
    ],
    "totals": { "calories": 495, "protein": 9, "carbohydrates": 81, "fat": 15 },
    "unmatchedItemCount": 1,
    "ai": { "provider": "anthropic", "model": "...", "inputTokens": 2100, "outputTokens": 450 },
    "failureReason": null,
    "processingTimeMs": 4200,
    "analysedAt": "...",
    "createdAt": "..."
  }
}
```

- `status`: `processing` | `completed` | `failed`. A failed analysis has a `failureReason` code, no
  items and `totals: null`.
- An item with `nutrients: null` matched no reference food, so it gets no made-up value. It is left out
  of `totals`, and `unmatchedItemCount` says how many items were left out. The user can pick the right
  food (`/nutrition/foods`) when editing.
- `portion.unit`: `g` | `ml` | `serving` (a reference food's typical serving).
- `imageUrl` is a signed link, valid for `SIGNED_URL_TTL_SECONDS`, when photos are in Supabase, and
  `null` with local storage. In that case load `GET /analyses/:id/image` with the Authorization header.
- Another user's analysis returns the same `404 ANALYSIS_NOT_FOUND` as an unknown id.

### Food recognition (Claude or Gemini)

Meal photos are analysed by the AI service chosen with `AI_PROVIDER` in `src/integrations/ai/`:

| `AI_PROVIDER`         | Key                 | Default model (`AI_MODEL`) |
| --------------------- | ------------------- | -------------------------- |
| `anthropic` (default) | `ANTHROPIC_API_KEY` | `claude-opus-5-5`          |
| `gemini`              | `GEMINI_API_KEY`    | `gemini-3.8-flash`         |

Both providers get the same instructions and schema (`prompt.ts`) and return the same result, so the
rest of the app doesn't know which one ran. The analysis records the provider and model that answered.
Another service can be added as a new file in `providers/`.

- **Request:** the cleaned-up photo, the user's notes (sent as information about the meal, not as
  instructions) and the nutrition catalog (every reference food's key, name and aliases).
- **Answer:** JSON checked against a schema: each visible item with its name, the matching catalog key
  or `null`, the estimated grams served, a portion description and a 0–1 confidence, plus the model's
  own calorie estimate for the whole meal. The catalog key can only be a real key, so the model can't
  invent foods. The calories the user sees are calculated from the reference data, not taken from the
  model; the model's own estimate is kept for evaluation.
- **Effort:** `AI_EFFORT` (default `medium`) sets how much the model reasons: higher may be more
  accurate but is slower and costs more. For Gemini it maps to the thinking level (`low`/`medium`/`high`;
  `xhigh` and `max` use `high`).
- **Claude:** structured outputs, and if Claude's safety classifiers decline a photo the request is
  retried server-side on Anthropic's recommended fallback model (`fallbacks: "default"`).
- **Gemini:** a JSON response schema; the answer is validated against the same Zod schema.

| Problem                                   | Status | Error code            |
| ----------------------------------------- | ------ | --------------------- |
| API key missing or rejected               | 503    | `AI_NOT_CONFIGURED`   |
| Rate limited                              | 503    | `AI_RATE_LIMITED`     |
| Timeout, network failure or service error | 503    | `AI_UNAVAILABLE`      |
| Photo declined by every model             | 422    | `AI_REFUSED`          |
| Answer unusable                           | 502    | `AI_INVALID_RESPONSE` |

### Meal records (food-intake history)

A meal record is the user's final version of an analysed meal. The analysis keeps the original AI
result; edits only change the meal record, so the two can be compared later.

- **Auto-save on** (`autoSaveResults: true`, the default): every completed analysis is saved straight
  away. `analysis.meal` in the `POST /analyses` response is `{ id, status, validatedByUser: false }`.
- **Auto-save off:** `analysis.meal` is `null` until the user reviews the result and calls
  `POST /analyses/:id/validate`, either with no body to accept it as it is, or with corrections.
  An analysis can be saved once (`409 MEAL_ALREADY_SAVED`, with `details.mealId`).
- **Editing:** `PATCH /meals/:id` with `items` replaces the meal's items and recalculates the nutrients.
  An empty body confirms the meal as it is. Either way `validatedByUser` becomes `true`.
- **Disputing:** `POST /analyses/:id/dispute` records that the AI result is wrong (kept for the
  evaluation). A meal saved from it gets `status: "disputed"` and stops counting in the summaries
  until the user corrects or confirms it with `PATCH /meals/:id`.
- **Deleting** a meal keeps the analysis, which can then be validated again.

Each item in `items` (validate and PATCH):

```json
{
  "recognisedItemId": "...",
  "name": "jollof rice",
  "nutritionReferenceId": "...",
  "quantity": 150,
  "unit": "g"
}
```

- `recognisedItemId`: the analysis item this corrects; leave it out for a food the AI missed.
- `nutritionReferenceId`: a food from `/nutrition/foods`. Its nutrients are calculated from the
  portion, so don't send nutrient values with it.
- For a food without reference data, send `calories` (and optionally `protein`, `carbohydrates`,
  `fat`) yourself; missing macros count as 0. Without them it is saved with no nutrients.
- `unit`: `g` | `ml` | `serving`. `serving` needs a reference food or your own calories.
- Errors: `UNKNOWN_RECOGNISED_ITEM`, `UNKNOWN_NUTRITION_REFERENCE`, `PORTION_NEEDS_REFERENCE`
  (all `400`, with `details.path` such as `items.2`).

### Daily summaries

Summaries add up the saved meals per calendar day in the user's timezone (`timezone`, an IANA name;
default `Africa/Lagos`), so a meal at 00:30 counts towards that new day. Send the device's timezone.

`GET /summary/daily?date=2026-10-15` returns:

```json
{
  "summary": {
    "timezone": "Africa/Lagos",
    "date": "2026-10-15",
    "totals": { "calories": 2700, "protein": 33, "carbohydrates": 423, "fat": 99 },
    "mealCount": 3,
    "dailyCalorieReference": 2759,
    "remainingCalories": 59,
    "percentOfReference": 98
  }
}
```

The reference is the one that applied on that day (the latest calculated on or before it), so past
days keep the target the user had then. Days before the profile existed have `null` reference fields.
`GET /summary?from=&to=` returns `days` (every day in the range, including empty ones), `totals`,
`loggedDays` and `averagePerLoggedDay` (averaged over days with at least one meal).

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

**With Firebase Auth** the app signs in through Firebase instead and sends
`await FirebaseAuth.instance.currentUser!.getIdToken()` to `POST /auth/firebase`. The server checks
the token against Firebase's public keys (no service account needed), so only
`FIREBASE_PROJECT_ID` has to be set. Google sign-in is accepted, and Apple will be too once it is
enabled in Firebase; other Firebase methods (email, phone, anonymous) get `400`. The response is our
own access and refresh tokens, as for every other sign-in, so the app uses those from then on, not
the Firebase token. Identities are stored under Google's/Apple's own user ID, so an account is the
same whether the user signed in through Firebase or `/auth/google`.
