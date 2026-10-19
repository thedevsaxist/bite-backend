import { describe, expect, it, vi } from 'vitest';

// For this file only: Gemini selected, with a Gemini key and no Claude key (tests/setup.ts clears
// both). Hoisted so it is set before the env module loads.
vi.hoisted(() => {
  process.env.AI_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'gemini-test-key';
});

const { foodRecognitionProvider } = await import('../src/integrations/ai/index.js');

describe('AI_PROVIDER=gemini', () => {
  it('uses the Gemini provider with GEMINI_API_KEY', () => {
    // Creating the provider makes no network call.
    expect(foodRecognitionProvider().name).toBe('gemini');
  });
});
