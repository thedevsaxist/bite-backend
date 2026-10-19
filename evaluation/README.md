# Evaluation

Measures the system against objective 4 of the report: food recognition, calorie estimation and
response time. Each photo goes through the same steps as `POST /analyses` (photo checks, AI
recognition, nutrition matching, calorie calculation), but nothing is stored.

## 1. Build the test set

Put the photos in `dataset/images/`, then copy `dataset/labels.example.json` to
`dataset/labels.json` and add one entry per photo:

```json
{
  "image": "images/jollof-dodo-chicken.jpg",
  "foods": ["jollof_rice", "fried_plantain", "chicken_fried"],
  "referenceCalories": 1050,
  "context": "optional notes, sent to the AI like a user's notes",
  "notes": "optional, for you: e.g. how the reference was measured"
}
```

- `foods`: what is really in the photo. Use the catalog keys from the nutrition data (see
  `src/db/seeds/nutrition-references.ts`, or `GET /nutrition/foods`). A food that isn't in the data
  can be listed by name, but then it only counts as found if the AI uses the same name.
- `referenceCalories` (optional): the meal's real calories. The most reliable way is to weigh each
  food before taking the photo and calculate from a food composition table. Photos without it still
  count for recognition.

## 2. Run it

```bash
npm run evaluate                        # all photos in evaluation/dataset
npm run evaluate -- --limit 5           # the first 5, to try it out
npm run evaluate -- --dataset other/dir --out other/results
```

It uses the AI provider, model and effort from `.env` (`AI_PROVIDER`, `AI_MODEL`, `AI_EFFORT`), and
each photo is one paid AI call. Run it once per provider or effort level to compare them. Photos are
analysed one at a time, so response times aren't affected by parallel requests.

## 3. Results

Each run writes `results/<time>-<provider>.json` (every photo's result) and a `.md` summary with:

- **Food recognition:** precision, recall and F1 over the foods in each photo, the share of photos
  where exactly the right foods were found, recall per food, and foods reported that weren't there.
  Photos that fail count as finding nothing.
- **Calorie estimation:** mean absolute error (kcal), mean absolute percentage error, mean error
  (bias: positive means estimates are too high) and the share within ±20% of the reference. Shown
  both for what the app displays (reference data applied to the recognised portions) and for the
  model's own estimate.
- **Response time:** mean, median, 95th percentile and maximum per photo, plus mean tokens used.
- **Failures:** how many photos failed, by error code (e.g. `IMAGE_TOO_BLURRY`, `NO_FOOD_DETECTED`).

`results/` is git-ignored.
