import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { foodAnalyses } from '../src/db/schema/index.js';
import { analysesRepository } from '../src/modules/analyses/analyses.repository.js';
import { failInterruptedAnalyses } from '../src/modules/analyses/stale-analyses.js';
import { signUp } from './helpers.js';

const app = createApp();

describe('interrupted analyses', () => {
  it('marks analyses stuck in "processing" for over 10 minutes as failed', async () => {
    const { userId } = await signUp(app);
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);
    const create = (createdAt: Date, analysisStatus: 'processing' | 'completed') =>
      analysesRepository.create({
        userId,
        imageReference: `${userId}/x.jpg`,
        analysisStatus,
        createdAt,
      }).id;
    const stuck = create(minutesAgo(20), 'processing');
    const running = create(minutesAgo(1), 'processing');
    const done = create(minutesAgo(30), 'completed');

    expect(failInterruptedAnalyses()).toBe(1);

    const status = (id: string) =>
      db.select().from(foodAnalyses).where(eq(foodAnalyses.id, id)).get()!;
    expect(status(stuck)).toMatchObject({ analysisStatus: 'failed', failureReason: 'INTERRUPTED' });
    expect(status(running).analysisStatus).toBe('processing');
    expect(status(done).analysisStatus).toBe('completed');
    expect(failInterruptedAnalyses()).toBe(0);
  });
});
