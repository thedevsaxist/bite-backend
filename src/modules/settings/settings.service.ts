import { db } from '../../db/index.js';
import type { UserSettings } from '../../db/schema/index.js';
import type { PatchSettingsInput } from './settings.schemas.js';
import { settingsRepository } from './settings.repository.js';

function toPublicSettings(settings: UserSettings) {
  return {
    autoSaveResults: settings.autoSaveResults,
    updatedAt: settings.updatedAt,
  };
}

export const settingsService = {
  get(userId: string) {
    return { settings: toPublicSettings(settingsRepository.findOrCreate(userId)) };
  },

  /** Used by the analysis pipeline to decide whether a result is saved straight away. */
  isAutoSaveEnabled(userId: string) {
    return settingsRepository.findOrCreate(userId).autoSaveResults;
  },

  patch(userId: string, input: PatchSettingsInput) {
    const settings = db.transaction((tx) => {
      settingsRepository.findOrCreate(userId, tx);
      return settingsRepository.update(userId, input, tx)!;
    });
    return { settings: toPublicSettings(settings) };
  },
};
