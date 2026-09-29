import fs from "fs/promises";
import path from "path";

export interface LoadedDocument {
  documentId: string;
  title: string;
  filename: string;
  category: string;
  content: string;
}

export async function loadDocumentsFromDirectory(dirPath: string): Promise<LoadedDocument[]> {
  const files = await fs.readdir(dirPath);
  
  const markdownFiles = files.filter((f) => f.endsWith(".md") || f.endsWith(".txt"));

  const docs: LoadedDocument[] = [];

  for (const filename of markdownFiles) {
    const filePath = path.join(dirPath, filename);
    const content = await fs.readFile(filePath, "utf-8");
    const documentId = path.parse(filename).name;

    // Extract title from first H1 or use documentId
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : documentId.replace(/-/g, " ");

    let category = "general";

    if (filename.includes("leave")) category = "leave_and_time_off";

    else if (filename.includes("remote") || filename.includes("byod") || filename.includes("equipment")) category = "workplace";

    else if (filename.includes("benefit") || filename.includes("expense") || filename.includes("travel")) category = "compensation";

    else if (filename.includes("security") || filename.includes("privacy")) category = "security";

    else if (filename.includes("conduct") || filename.includes("whistleblower")) category = "ethics";

    docs.push({
      documentId,
      title,
      filename,
      category,
      content
    });
  }

  return docs;
}
