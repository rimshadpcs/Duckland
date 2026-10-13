import { saveRoomPdfSourceAction } from "@src/app/study/actions";
import { createSupabaseBrowserClient } from "@src/lib/supabase/browser";

export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_UNREADABLE_MESSAGE = "We couldn't read this PDF. Try a different file or paste the text instead.";

export function validatePdfFile(file: File) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "Please upload a PDF file.";
  if (file.size > PDF_MAX_BYTES) return "This PDF is larger than 10 MB. Choose a smaller file for now.";
  return null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizePdfFileName(name: string) {
  const baseName = name.replace(/\.pdf$/i, "").trim() || "study-material";
  return `${baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "study-material"}.pdf`;
}

type SavedPdfSource = Extract<Awaited<ReturnType<typeof saveRoomPdfSourceAction>>, { ok: true }>["data"];

/**
 * Uploads a PDF to the room's storage folder, extracts its text in the browser and saves it as a
 * source. The uploaded file is removed again if any later step fails.
 */
export async function uploadPdfSource({
  file,
  roomId,
  roomTitle,
  onStatus,
  onProgress,
}: {
  file: File;
  roomId: string;
  roomTitle: string;
  onStatus?: (status: string) => void;
  onProgress?: (currentPage: number, totalPages: number) => void;
}): Promise<SavedPdfSource> {
  const supabase = createSupabaseBrowserClient();
  let uploadedPath: string | null = null;

  try {
    onStatus?.("Uploading your PDF...");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("You must be signed in to upload a PDF.");

    const storagePath = `${user.id}/${roomId}/${Date.now()}-${sanitizePdfFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("study-files")
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message || "Could not upload this PDF.");
    uploadedPath = storagePath;

    onStatus?.("Reading page 1...");
    const { extractPdfText } = await import("./extractPdfText");
    const extraction = await extractPdfText(file, (currentPage, totalPages) => {
      onProgress?.(currentPage, totalPages);
      onStatus?.(`Reading page ${currentPage} of ${totalPages}...`);
    });

    onStatus?.("Saving extracted text...");
    const result = await saveRoomPdfSourceAction({
      roomId,
      roomTitle,
      title: file.name,
      content: extraction.text,
      originalFileName: file.name,
      storagePath,
      pageCount: extraction.pageCount,
      extractedTextLength: extraction.extractedTextLength,
    });

    if (!result.ok) throw new Error(result.error);

    uploadedPath = null;
    return result.data;
  } catch (caught) {
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from("study-files").remove([uploadedPath]);
      if (cleanupError && process.env.NODE_ENV === "development") {
        console.warn("[Study] could not remove failed PDF upload", cleanupError);
      }
    }

    throw caught instanceof Error ? caught : new Error(PDF_UNREADABLE_MESSAGE);
  }
}
