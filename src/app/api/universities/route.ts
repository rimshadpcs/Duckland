import { NextResponse } from "next/server";
import { searchUniversities } from "@src/lib/services/universities";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "").trim();
  const country = (url.searchParams.get("country") || "").trim();

  if (name.length < 2) {
    return NextResponse.json({ error: "Type at least 2 characters.", universities: [] }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const universities = await searchUniversities({
      name,
      country,
      signal: controller.signal,
    });

    return NextResponse.json({ universities });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "University search timed out."
        : "University search is unavailable.";

    return NextResponse.json({ error: message, universities: [] }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
