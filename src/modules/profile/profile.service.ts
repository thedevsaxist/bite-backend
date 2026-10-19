import { db } from '../../db/index.js';
import type { DietaryReference, UserProfile } from '../../db/schema/index.js';
import { AppError } from '../../utils/app-error.js';
import { calculateDietaryReference, type DietaryInputs } from './dietary-reference.js';
import type { PatchProfileInput, PutProfileInput } from './profile.schemas.js';
import { profileRepository } from './profile.repository.js';

const profileNotFound = () => new AppError(404, 'Set up your profile first', 'PROFILE_NOT_FOUND');

function toPublicProfile(profile: UserProfile) {
  return {
    age: profile.age,
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    activityLevel: profile.activityLevel,
    weightGoal: profile.weightGoal,
    updatedAt: profile.updatedAt,
  };
}

function toPublicReference(reference: DietaryReference) {
  return {
    dailyCalorieReference: reference.dailyCalorieReference,
    bmr: reference.bmr,
    maintenanceCalories: reference.maintenanceCalories,
    calculatedAt: reference.calculatedAt,
  };
}

/** Saves the profile and, if the result changed, a new dietary reference, in one transaction. */
function saveProfile(userId: string, inputs: DietaryInputs) {
  return db.transaction((tx) => {
    const profile = profileRepository.upsert(userId, inputs, tx);

    const calculated = calculateDietaryReference(inputs);
    const latest = profileRepository.findLatestReference(userId, tx);
    const unchanged =
      latest &&
      latest.bmr === calculated.bmr &&
      latest.maintenanceCalories === calculated.maintenanceCalories &&
      latest.dailyCalorieReference === calculated.dailyCalorieReference;
    const reference = unchanged
      ? latest
      : profileRepository.createReference({ userId, ...calculated }, tx);

    return { profile: toPublicProfile(profile), dietaryReference: toPublicReference(reference) };
  });
}

export const profileService = {
  get(userId: string) {
    const profile = profileRepository.findByUserId(userId);
    if (!profile) throw profileNotFound();
    return { profile: toPublicProfile(profile) };
  },

  put(userId: string, input: PutProfileInput) {
    return saveProfile(userId, input);
  },

  patch(userId: string, input: PatchProfileInput) {
    const existing = profileRepository.findByUserId(userId);
    if (!existing) throw profileNotFound();
    const { age, sex, weightKg, heightCm, activityLevel, weightGoal } = existing;
    return saveProfile(userId, {
      age,
      sex,
      weightKg,
      heightCm,
      activityLevel,
      weightGoal,
      ...input,
    });
  },

  getDietaryReference(userId: string) {
    const reference = profileRepository.findLatestReference(userId);
    if (!reference) throw profileNotFound();
    return { dietaryReference: toPublicReference(reference) };
  },
};
