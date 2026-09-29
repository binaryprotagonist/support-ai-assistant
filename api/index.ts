import { IncomingMessage, ServerResponse } from "http";
import app from "../server/src/server.js";
import { connectDatabase } from "../server/src/config/database.js";

let isDbConnected = false;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!isDbConnected) {
      await connectDatabase();
      isDbConnected = true;
    }
  } catch (err: any) {
    console.error("[Vercel Serverless API] Database connection error:", err.message);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Database connection failed",
        message: err.message,
        tip: "Please configure MONGODB_URI in your Vercel Project Environment Variables."
      })
    );
    return;
  }

  return (app as any)(req, res);
}
