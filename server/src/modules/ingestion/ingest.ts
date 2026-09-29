import fs from "fs";
import path from "path";
import { loadDocumentsFromDirectory } from "./loader.js";
import { chunkDocument, DocumentChunk } from "./chunker.js";
import { defaultEmbedder } from "./embedder.js";
import { Document as MongoDocument } from "../../models/Document.js";
import { Chunk as MongoChunk } from "../../models/Chunk.js";
import mongoose from "mongoose";

export interface IngestionResult {
  totalDocuments: number;
  totalChunks: number;
  chunks: DocumentChunk[];
}

export async function runIngestion(docsDir?: string): Promise<IngestionResult> {
  let targetDir = docsDir;
  if (!targetDir) {
    const candidates = [
      path.resolve(process.cwd(), "documents"),
      path.resolve(process.cwd(), "..", "documents"),
      path.resolve(process.cwd(), "server", "documents")
    ];
    targetDir = candidates.find((dir) => {
      try {
        return fs.existsSync(dir);
      } catch {
        return false;
      }
    }) || candidates[0];
  }
  console.log(`[Ingestion] Loading documents from ${targetDir}...`);

  const rawDocs = await loadDocumentsFromDirectory(targetDir);
  console.log(`[Ingestion] Found ${rawDocs.length} policy documents.`);

  const allChunks: DocumentChunk[] = [];

  for (const rawDoc of rawDocs) {
    const docChunks = chunkDocument(rawDoc);

    // Embed all chunks for this doc
    const texts = docChunks.map((c) => `${c.section}\n${c.text}`);
    const embeddings = await defaultEmbedder.embedDocuments(texts);

    for (let i = 0; i < docChunks.length; i++) {
      docChunks[i].embedding = embeddings[i];
      allChunks.push(docChunks[i]);
    }

    // Persist Document metadata to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      await MongoDocument.findOneAndUpdate(
        { documentId: rawDoc.documentId },
        {
          documentId: rawDoc.documentId,
          title: rawDoc.title,
          filename: rawDoc.filename,
          category: rawDoc.category,
          chunkCount: docChunks.length,
          status: "indexed"
        },
        { upsert: true, new: true }
      );

      // Persist Chunks to MongoDB
      for (const chunk of docChunks) {
        await MongoChunk.findOneAndUpdate(
          { chunkId: chunk.chunkId },
          {
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            section: chunk.section,
            page: chunk.page,
            text: chunk.text,
            tokenCount: chunk.tokenCount,
            embedding: chunk.embedding
          },
          { upsert: true, new: true }
        );
      }
    }
  }

  console.log(`[Ingestion] Completed. Indexed ${rawDocs.length} documents into ${allChunks.length} chunks.`);

  return {
    totalDocuments: rawDocs.length,
    totalChunks: allChunks.length,
    chunks: allChunks
  };
}
