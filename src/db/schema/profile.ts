import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, id, timestamp, updatedAt } from './columns.js';
import { users } from './users.js';

// Only the two values the Mifflin–St Jeor equation has constants for.
export const sexes = ['male', 'female'] as const;
export type Sex = (typeof sexes)[number];

export const activityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof activityLevels)[number];

export const weightGoals = ['lose', 'maintain', 'gain'] as const;
export type WeightGoal = (typeof weightGoals)[number];

// Report §3.5.3 "User Profiles": the inputs to the daily calorie reference. One per user.
export const userProfiles = sqliteTable('user_profiles', {
  id: id(),
  userId: text()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  age: integer().notNull(),
  sex: text({ enum: sexes }).notNull(),
  weightKg: real().notNull(),
  heightCm: real().notNull(),
  activityLevel: text({ enum: activityLevels }).notNull(),
  weightGoal: text({ enum: weightGoals }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Report §3.5.3 "Dietary References": a new row each time the profile changes the result,
// so intake on a past day can be compared with the reference that applied then.
export const dietaryReferences = sqliteTable(
  'dietary_references',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bmr: integer().notNull(),
    maintenanceCalories: integer().notNull(),
    dailyCalorieReference: integer().notNull(),
    calculatedAt: timestamp()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('dietary_references_user_calculated_idx').on(t.userId, t.calculatedAt)],
);

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type DietaryReference = typeof dietaryReferences.$inferSelect;
export type NewDietaryReference = typeof dietaryReferences.$inferInsert;
