import { LoadedDocument } from "./loader.js";

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  section: string;
  page: number;
  text: string;
  tokenCount: number;
  embedding?: number[];
}

export function chunkDocument(doc: LoadedDocument): DocumentChunk[] {
  
  const chunks: DocumentChunk[] = [];
  
  // Split on Markdown H2 headers (e.g. "## 1. Annual Paid Leave")
  const sections = doc.content.split(/(?=^##\s+)/m);
  
  let chunkIndex = 1;

  for (let i = 0; i < sections.length; i++) {
    const sectionBlock = sections[i].trim();
  
    if (!sectionBlock) continue;

    // Skip the pure H1 document title line if present at start
    if (i === 0 && !sectionBlock.startsWith("##") && sectionBlock.length < 100) {
      continue;
    }

    // Check if block has a heading
    const headingMatch = sectionBlock.match(/^##\s+(.+)$/m);
    const sectionName = headingMatch ? headingMatch[1].trim() : `Section ${i}`;

    // If section block is small-to-moderate (< 1200 characters), keep as single coherent chunk
    if (sectionBlock.length <= 1200) {
      const tokenCount = Math.ceil(sectionBlock.length / 4);
      
      chunks.push({
        chunkId: `${doc.documentId}-chunk-${chunkIndex++}`,
        documentId: doc.documentId,
        documentName: doc.title,
        section: sectionName,
        page: Math.ceil(chunkIndex / 4), // Approximate page number
        text: sectionBlock,
        tokenCount
      });
    } 
    else {
      // Split large section on paragraphs
      const paragraphs = sectionBlock.split(/\n\n+/);
      let currentText = "";

      for (const p of paragraphs) {
        if ((currentText + "\n\n" + p).length > 800 && currentText.length > 0) {
          chunks.push({
            chunkId: `${doc.documentId}-chunk-${chunkIndex++}`,
            documentId: doc.documentId,
            documentName: doc.title,
            section: sectionName,
            page: Math.ceil(chunkIndex / 4),
            text: currentText.trim(),
            tokenCount: Math.ceil(currentText.length / 4)
          });
          currentText = `[${sectionName} - Cont.]\n` + p;
        } else {
          currentText = currentText ? `${currentText}\n\n${p}` : p;
        }
      }

      if (currentText.trim().length > 0) {
        chunks.push({
          chunkId: `${doc.documentId}-chunk-${chunkIndex++}`,
          documentId: doc.documentId,
          documentName: doc.title,
          section: sectionName,
          page: Math.ceil(chunkIndex / 4),
          text: currentText.trim(),
          tokenCount: Math.ceil(currentText.length / 4)
        });
      }
    }
  }

  return chunks;
}
