import { desc, eq } from 'drizzle-orm';
import { db, type Executor } from '../../db/index.js';
import {
  dietaryReferences,
  userProfiles,
  type NewDietaryReference,
  type NewUserProfile,
} from '../../db/schema/index.js';

export const profileRepository = {
  findByUserId(userId: string, executor: Executor = db) {
    return executor.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  },

  /** Creates the user's profile, or replaces the existing one. */
  upsert(userId: string, fields: Omit<NewUserProfile, 'userId'>, executor: Executor = db) {
    return executor
      .insert(userProfiles)
      .values({ userId, ...fields })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { ...fields, updatedAt: new Date() },
      })
      .returning()
      .get();
  },

  findLatestReference(userId: string, executor: Executor = db) {
    return executor
      .select()
      .from(dietaryReferences)
      .where(eq(dietaryReferences.userId, userId))
      .orderBy(desc(dietaryReferences.calculatedAt))
      .limit(1)
      .get();
  },

  createReference(data: NewDietaryReference, executor: Executor = db) {
    return executor.insert(dietaryReferences).values(data).returning().get();
  },
};
