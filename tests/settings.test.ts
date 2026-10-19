import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { settingsService } from '../src/modules/settings/settings.service.js';
import { signUp } from './helpers.js';

const app = createApp();

describe('settings', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(401);
  });

  it('turns auto-save on by default', async () => {
    const { auth, userId } = await signUp(app);

    const res = await request(app).get('/api/v1/settings').set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.data.settings.autoSaveResults).toBe(true);
    expect(settingsService.isAutoSaveEnabled(userId)).toBe(true);
  });

  it('turns auto-save off', async () => {
    const { auth, userId } = await signUp(app);

    const res = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', auth)
      .send({ autoSaveResults: false });

    expect(res.status).toBe(200);
    expect(res.body.data.settings.autoSaveResults).toBe(false);
    expect(settingsService.isAutoSaveEnabled(userId)).toBe(false);

    const fetched = await request(app).get('/api/v1/settings').set('Authorization', auth);
    expect(fetched.body.data.settings.autoSaveResults).toBe(false);
  });

  it('validates the body', async () => {
    const { auth } = await signUp(app);

    const wrongType = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', auth)
      .send({ autoSaveResults: 'no' });
    const unknownKey = await request(app)
      .patch('/api/v1/settings')
      .set('Authorization', auth)
      .send({ theme: 'dark' });
    const empty = await request(app).patch('/api/v1/settings').set('Authorization', auth).send({});

    expect([wrongType.status, unknownKey.status, empty.status]).toEqual([400, 400, 400]);
  });
});
