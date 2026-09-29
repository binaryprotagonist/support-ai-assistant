import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load from server directory or root
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  
  MONGODB_URI: z.string().optional(),
  
  // Primary: Gemini
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
  
  // Fallback: Grok (xAI)
  GROK_API_KEY: z.string().optional().default(""),
  GROK_BASE_URL: z.string().default("https://api.x.ai/v1"),
  GROK_MODEL: z.string().default("grok-2-latest"),
  
  // Reliability & Budgeting
  REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
  MAX_RETRIES: z.coerce.number().default(3),
  MAX_COST_PER_REQUEST_USD: z.coerce.number().default(0.05),
  MAX_TOKENS_PER_REQUEST: z.coerce.number().default(4000),
  
  // Tracing
  LANGSMITH_TRACING: z.coerce.boolean().default(false),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default("support-assistant-production")
});

export const env = envSchema.parse(process.env);
