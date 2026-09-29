import { Router, Request, Response, NextFunction } from "express";
import { Document } from "../models/Document.js";
import { Chunk } from "../models/Chunk.js";

const router = Router();

router.get("/documents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await Document.find().sort({ title: 1 });
    const totalChunks = await Chunk.countDocuments();

    res.json({
      success: true,
      totalDocuments: docs.length,
      totalChunks,
      documents: docs
    });
  } catch (error) {
    next(error);
  }
});

router.get("/documents/:documentId/chunks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chunks = await Chunk.find({ documentId: req.params.documentId }).sort({ page: 1, chunkId: 1 });
    res.json({
      success: true,
      count: chunks.length,
      chunks
    });
  } catch (error) {
    next(error);
  }
});

export default router;
