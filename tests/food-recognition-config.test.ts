import { describe, expect, it } from 'vitest';
import { foodRecognitionProvider } from '../src/integrations/ai/index.js';

describe('food recognition config', () => {
  it('returns AI_NOT_CONFIGURED when no API key is set', () => {
    // tests/setup.ts clears ANTHROPIC_API_KEY so tests never call the real API.
    expect(() => foodRecognitionProvider()).toThrow(
      expect.objectContaining({ statusCode: 503, code: 'AI_NOT_CONFIGURED' }),
    );
  });
});
