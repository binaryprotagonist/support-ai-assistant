import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import healthRoutes from "./routes/health.routes.js";
import questionsRoutes from "./routes/questions.routes.js";
import approvalsRoutes from "./routes/approvals.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import runsRoutes from "./routes/runs.routes.js";
import evaluationRoutes from "./routes/evaluation.routes.js";

export const app = express();

// Middleware: CORS supporting local dev, custom CLIENT_URL, and *.vercel.app deployments
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        env.CLIENT_URL === "*" ||
        origin === env.CLIENT_URL ||
        origin.endsWith(".vercel.app") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true
  })
);

app.use(express.json());
app.use(requestLogger);

// API Routes (mounted on both /api and / for seamless standalone and serverless execution)
const apiRouter = express.Router();
apiRouter.use(healthRoutes);
apiRouter.use(questionsRoutes);
apiRouter.use(approvalsRoutes);
apiRouter.use(documentsRoutes);
apiRouter.use(runsRoutes);
apiRouter.use(evaluationRoutes);

app.use("/api", apiRouter);
app.use("/", apiRouter);

// Error Handling
app.use(errorHandler);

// Start server function
export async function startServer() {
  await connectDatabase();
  const server = app.listen(env.PORT, () => {
    console.log(`[Server] Support Assistant API listening on http://localhost:${env.PORT}`);
    console.log(`[Server] Primary LLM: ${env.GEMINI_MODEL} (Gemini)`);
    console.log(`[Server] Fallback LLM: ${env.GROK_MODEL} (Grok / xAI)`);
    console.log(`[Server] Started at url : http://localhost:${env.PORT}  ${new Date()}`);
  });
  return server;
}

// Auto-run if executed directly as a standalone process or Vercel Express service
if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("[Server] Fatal bootstrap error:", err);
    process.exit(1);
  });
}

export default app;
