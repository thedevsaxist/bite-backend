import { Router } from 'express';

// Stage 3 (report §3.5.3 "User Settings"): per-user app preferences.
// Planned (all require auth):
//   GET   /settings   current settings (auto_save_results defaults to true)
//   PATCH /settings   change one or more settings
export const settingsRouter = Router();
