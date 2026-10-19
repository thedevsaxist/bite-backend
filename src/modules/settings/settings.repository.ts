import { eq } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import { userSettings, type NewUserSettings } from '../../db/schema/index.js';

export const settingsRepository = {
  /** Returns the user's settings, creating the default row the first time. */
  findOrCreate(userId: string, executor: Executor = db) {
    executor.insert(userSettings).values({ userId }).onConflictDoNothing().run();
    return executor.select().from(userSettings).where(eq(userSettings.userId, userId)).get()!;
  },

  update(userId: string, data: Partial<NewUserSettings>, executor: Executor = db) {
    return executor
      .update(userSettings)
      .set(data)
      .where(eq(userSettings.userId, userId))
      .returning()
      .get();
  },
};
