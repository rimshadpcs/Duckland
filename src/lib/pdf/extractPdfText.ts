export type PdfExtractionResult = {
  text: string;
  pageCount: number;
  extractedTextLength: number;
};

const MAX_PAGE_COUNT = 100;
const MIN_EXTRACTED_TEXT_LENGTH = 300;

export const PDF_EXTRACTION_ERRORS = {
  tooManyPages: "This PDF has more than 100 pages. Try uploading one chapter or a smaller section.",
  notEnoughText:
    "We couldn't extract enough text from this PDF.\n\nFeynduck currently works best with PDFs that contain selectable text, such as lecture slides, textbooks, and digital handouts.",
  unreadable: "We couldn't read this PDF. Try a different file or paste the text instead.",
} as const;

function cleanPageText(value: string) {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type PdfTextItem = {
  str: string;
  width?: number;
  transform?: number[];
};

function getTextItemX(item: PdfTextItem) {
  return Array.isArray(item.transform) && typeof item.transform[4] === "number" ? item.transform[4] : 0;
}

function getTextItemY(item: PdfTextItem) {
  return Array.isArray(item.transform) && typeof item.transform[5] === "number" ? item.transform[5] : 0;
}

function buildReadablePageText(items: unknown[]) {
  const textItems = items
    .filter((item): item is PdfTextItem => {
      if (!item || typeof item !== "object" || !("str" in item)) return false;
      const textItem = item as PdfTextItem;
      return typeof textItem.str === "string" && textItem.str.length > 0;
    })
    .map((item) => ({
      str: item.str,
      width: typeof item.width === "number" ? item.width : item.str.length * 4,
      x: getTextItemX(item),
      y: getTextItemY(item),
    }))
    .sort((a, b) => {
      const yDifference = b.y - a.y;
      return Math.abs(yDifference) > 2 ? yDifference : a.x - b.x;
    });

  const lines: typeof textItems[] = [];
  for (const item of textItems) {
    const currentLine = lines[lines.length - 1];
    if (!currentLine || Math.abs(currentLine[0].y - item.y) > 2) {
      lines.push([item]);
    } else {
      currentLine.push(item);
    }
  }

  const lineTexts = lines.map((line) => {
    const sortedLine = [...line].sort((a, b) => a.x - b.x);
    let text = "";
    let previousEnd: number | null = null;

    for (const item of sortedLine) {
      const clean = item.str.replace(/\s+/g, " ");
      if (!clean.trim()) continue;

      if (previousEnd != null) {
        const gap = item.x - previousEnd;
        const averageGlyphWidth = Math.max(2.5, item.width / Math.max(clean.length, 1));
        if (gap > averageGlyphWidth * 0.75 && !text.endsWith(" ")) {
          text += " ";
        }
      }

      text += clean;
      previousEnd = item.x + item.width;
    }

    return text.trim();
  });

  return cleanPageText(lineTexts.filter(Boolean).join("\n"));
}

function getMeaningfulLength(value: string) {
  return value.replace(/\s+/g, "").length;
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";

  const candidate = error as { name?: unknown; message?: unknown };
  return [candidate.name, candidate.message].filter((item): item is string => typeof item === "string").join(" ");
}

export async function extractPdfText(
  file: File,
  onProgress?: (currentPage: number, totalPages: number) => void,
): Promise<PdfExtractionResult> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

    const data = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    });
    const pdf = await documentTask.promise;

    const pageCount = pdf.numPages;

    if (pageCount > MAX_PAGE_COUNT) {
      throw new Error(PDF_EXTRACTION_ERRORS.tooManyPages);
    }

    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = buildReadablePageText(textContent.items);

      if (pageText) {
        pages.push(`--- Page ${pageNumber} ---\n${pageText}`);
      }

      onProgress?.(pageNumber, pageCount);
      page.cleanup();
    }

    await pdf.destroy();

    const text = cleanPageText(pages.join("\n\n"));
    const extractedTextLength = getMeaningfulLength(text);

    if (extractedTextLength < MIN_EXTRACTED_TEXT_LENGTH) {
      throw new Error(PDF_EXTRACTION_ERRORS.notEnoughText);
    }

    return {
      text,
      pageCount,
      extractedTextLength,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (Object.values(PDF_EXTRACTION_ERRORS).includes(message as (typeof PDF_EXTRACTION_ERRORS)[keyof typeof PDF_EXTRACTION_ERRORS])) {
      throw error;
    }

    const details = getErrorMessage(error);
    if (/password|encrypted|invalid pdf|missing pdf|unexpected server response/i.test(details)) {
      throw new Error(PDF_EXTRACTION_ERRORS.unreadable);
    }

    throw new Error(PDF_EXTRACTION_ERRORS.unreadable);
  }
}
