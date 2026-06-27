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
      const textItems = textContent.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean);
      const pageText = cleanPageText(textItems.join(" "));

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
