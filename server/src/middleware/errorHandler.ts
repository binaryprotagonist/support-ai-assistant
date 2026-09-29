import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: err.errors
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
  });
}
