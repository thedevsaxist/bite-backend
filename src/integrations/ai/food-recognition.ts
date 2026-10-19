// The contract between the analysis pipeline and an external multimodal AI model (report §3.5.4).
// The pipeline codes against this interface only, so the model can be swapped without touching it.
// Implementations live in ./providers/ (Claude first, stage 7).

/** One food component the model identified in the image. */
export type RecognisedItem = {
  name: string;
  // Key of the matching row in nutritional_references, or null when the model found no match.
  // Unmatched items get no calories rather than a made-up value (report §3.5.5).
  nutritionKey: string | null;
  estimatedGrams: number | null;
  portionDescription: string | null;
  // 0–1, where the model reports it.
  confidence: number | null;
};

export type RecognitionResult = {
  items: RecognisedItem[];
  // The model's own calorie guess for the whole meal. Kept for evaluation only; the calories the
  // user sees are calculated from nutritional_references.
  modelCalorieEstimate: number | null;
  // The provider's raw structured response, stored as food_analyses.ai_result.
  raw: unknown;
  provider: string;
  // The model that produced the answer (a fallback model if the requested one declined).
  model: string;
  usage: { inputTokens: number; outputTokens: number };
};

/** A food the model may map recognised items to (a row of nutritional_references). */
export type CatalogFood = { key: string; name: string; aliases: string[] };

export type RecognitionInput = {
  image: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };
  // Optional user-provided meal information (ingredients, portion sizes).
  context?: string;
  nutritionCatalog: CatalogFood[];
};

export interface FoodRecognitionProvider {
  readonly name: string;
  recognise(input: RecognitionInput): Promise<RecognitionResult>;
}
