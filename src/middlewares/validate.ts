import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/**
 * Validates (and coerces) the request against Zod schemas before it reaches the controller.
 * Validation failures throw a ZodError, which the error handler turns into a 400 response.
 *
 * Usage: router.post('/', validate({ body: createMealSchema }), controller.create)
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    if (schemas.query) {
      // req.query is a read-only getter in Express 5, so redefine it with the parsed value.
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
        enumerable: true,
      });
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
}
