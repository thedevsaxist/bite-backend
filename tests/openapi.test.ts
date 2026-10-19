import fs from 'node:fs';
import type { Router } from 'express';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { analysesRouter } from '../src/modules/analyses/analyses.routes.js';
import { authRouter } from '../src/modules/auth/auth.routes.js';
import { healthRouter } from '../src/modules/health/health.routes.js';
import { mealsRouter } from '../src/modules/meals/meals.routes.js';
import { nutritionRouter } from '../src/modules/nutrition/nutrition.routes.js';
import { profileRouter } from '../src/modules/profile/profile.routes.js';
import { settingsRouter } from '../src/modules/settings/settings.routes.js';
import { summaryRouter } from '../src/modules/summary/summary.routes.js';
import { usersRouter } from '../src/modules/users/users.routes.js';

// Keeps docs/openapi.yaml in step with the code: every route is documented and every documented
// operation exists. The mount paths mirror src/routes/index.ts.
const mounted: [string, Router][] = [
  ['/health', healthRouter],
  ['/auth', authRouter],
  ['/users', usersRouter],
  ['/profile', profileRouter],
  ['/settings', settingsRouter],
  ['/nutrition', nutritionRouter],
  ['/analyses', analysesRouter],
  ['/meals', mealsRouter],
  ['/summary', summaryRouter],
];

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

function implementedOperations() {
  const operations: string[] = [];
  for (const [prefix, router] of mounted) {
    for (const layer of router.stack as RouteLayer[]) {
      if (!layer.route) continue;
      const path = (prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(
        /:(\w+)/g,
        '{$1}',
      );
      for (const method of Object.keys(layer.route.methods))
        operations.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations.sort();
}

function documentedOperations() {
  const spec = parse(fs.readFileSync('docs/openapi.yaml', 'utf8')) as {
    paths: Record<string, object>;
  };
  return Object.entries(spec.paths)
    .flatMap(([path, item]) =>
      Object.keys(item)
        .filter((key) => ['get', 'post', 'put', 'patch', 'delete'].includes(key))
        .map((method) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

describe('docs/openapi.yaml', () => {
  it('documents exactly the routes the API implements', () => {
    expect(documentedOperations()).toEqual(implementedOperations());
  });

  it('gives every operation a unique operationId', () => {
    const spec = parse(fs.readFileSync('docs/openapi.yaml', 'utf8')) as {
      paths: Record<string, Record<string, { operationId?: string }>>;
    };
    const ids = Object.values(spec.paths).flatMap((item) =>
      Object.values(item).map((op) => op.operationId),
    );
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
