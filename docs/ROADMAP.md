# Backend roadmap

One stage per turn. Each stage adds its own tables, generates its own migration (`npm run db:generate`)
and ships with tests. FR numbers refer to the functional requirements in report §3.4.1.

Decisions:

- **AI:** code against `FoodRecognitionProvider` (`src/integrations/ai/food-recognition.ts`). Claude is the
  first provider; others can be added without changing the pipeline.
- **Nutrition data:** a seeded local `nutritional_references` table: FAO/INFOODS West African Food
  Composition Table for local dishes, USDA values for common foods. No live external lookup.

## Stages

- [x] **1. Scaffold**: Express 5, TypeScript, SQLite + Drizzle, logging, error handling, tests
- [x] **2. Auth**: email/password, Google and Apple sign-in, JWT access + rotating refresh tokens (FR 1, 2, 22)
- [ ] **3. Profile, settings, daily calorie reference** (FR 3, 4) · module `profile`, `settings`
  - Tables: `user_profiles`, `user_settings` (`auto_save_results` default `true`), `dietary_references`
  - `GET /profile`, `PUT /profile`, `GET /profile/dietary-reference`, `GET /settings`, `PATCH /settings`
  - Mifflin–St Jeor BMR × activity factor, adjusted for the weight goal, with a minimum. A new
    `dietary_references` row is written whenever the profile changes.
- [ ] **4. Nutrition reference data** (FR 13, 21) · module `nutrition`
  - Table: `nutritional_references`; seed data in `src/db/seeds/`
  - `GET /nutrition/foods?q=`, `GET /nutrition/foods/:id`
  - Calorie calculation: `Cᵢ = Sᵢ × Cₛ`, `C_meal = ΣCᵢ` (report §3.5.5)
- [ ] **5. Image upload & validation** (FR 5, 6, 8, 9) · module `analyses`
  - multer upload; type, size and dimension checks; blur check (`sharp`); downscale only, never upscale
- [ ] **6. Analysis records** · module `analyses`
  - Tables: `food_analyses` (keeps the original `ai_result`), `recognised_food_items`
  - `GET /analyses/:id`, `GET /analyses/:id/image`
- [ ] **7. AI recognition (Claude)** (FR 10, 11, 12, 20) · `src/integrations/ai/`
  - `prompt.ts`, `providers/anthropic.ts`; Zod-validated structured output; provider errors mapped to API errors
  - The prompt includes the nutrition catalog so the model maps each item to a reference key or `null`
- [ ] **8. Analysis pipeline** (FR 7, 14, 15, 20, 21) · module `analyses`
  - `POST /analyses` (multipart image + optional context): validate → AI → match nutrition → calculate → store
  - Unmatched items get no calories and are flagged `NO_NUTRITION_MATCH`
- [ ] **9. Meal records & history** (FR 16, 17, 18, 19) · modules `meals`, `summary`
  - Tables: `meal_records`, `meal_items`
  - Auto-save when `auto_save_results` is on; otherwise `POST /analyses/:id/validate`
  - `POST /analyses/:id/dispute`, `GET /meals?from&to`, `GET /meals/:id`, `PATCH /meals/:id`, `DELETE /meals/:id`
  - `GET /summary/daily?date`, `GET /summary?from&to`
- [ ] **10. Evaluation harness** (Objective 4) · `evaluation/`
  - `npm run evaluate`: accuracy, precision, recall, F1; calorie MAE and MAPE; response time
- [ ] **11. Hardening & docs** (non-functional requirements)
  - API docs / Postman collection, account deletion, cleanup of stale pending analyses, deployment
    notes (feeds report §4.1)
