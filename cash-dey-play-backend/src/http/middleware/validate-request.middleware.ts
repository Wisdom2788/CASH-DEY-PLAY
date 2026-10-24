import { type NextFunction, type Request, type Response } from "express";
import { type ZodTypeAny } from "zod";

export function validateRequest(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      next();
    } catch (error) { next(error); }
  };
}
