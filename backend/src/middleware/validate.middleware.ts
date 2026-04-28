/**
 * validate.middleware.ts – Zod schema validation middleware
 * Dependencies: zod
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(source === 'body' ? req.body : req.query);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION',
          message: 'Invalid input',
          details: result.error.errors,
        },
      });
      return;
    }
    if (source === 'body') {
      req.body = result.data;
    } else {
      // Express 5: req.query is read-only on direct assignment but its keys are mutable.
      for (const k of Object.keys(req.query)) delete (req.query as any)[k];
      Object.assign(req.query as any, result.data);
    }
    next();
  };
}
