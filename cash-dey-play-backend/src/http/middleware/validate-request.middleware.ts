import { type NextFunction, type Request, type Response } from "express";
import { type ZodTypeAny, ZodError } from "zod";

export function validateRequest(schema: ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: "ValidationError",
          details: error.issues,
        });
        return;
      }
      next(error);
    }
  };
}
