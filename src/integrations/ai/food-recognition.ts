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
  model: string;
};

export type RecognitionInput = {
  image: { data: Buffer; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };
  // Optional user-provided meal information (ingredients, portion sizes).
  context?: string;
  // Keys and names from nutritional_references the model may map items to.
  nutritionCatalog: { key: string; name: string }[];
};

export interface FoodRecognitionProvider {
  readonly name: string;
  recognise(input: RecognitionInput): Promise<RecognitionResult>;
}
