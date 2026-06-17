export type UniversitySuggestion = {
  name: string;
  country: string;
  website?: string | null;
};

type UniversityApiResult = {
  name?: unknown;
  country?: unknown;
  web_pages?: unknown;
};

function normaliseResult(item: UniversityApiResult): UniversitySuggestion | null {
  if (typeof item.name !== "string" || typeof item.country !== "string") {
    return null;
  }

  const websites = Array.isArray(item.web_pages) ? item.web_pages : [];
  const website = websites.find((value): value is string => typeof value === "string") || null;

  return {
    name: item.name,
    country: item.country,
    website,
  };
}

export async function searchUniversities({
  name,
  country,
  signal,
}: {
  name: string;
  country?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({ name });
  if (country && country !== "Other") params.set("country", country);

  const response = await fetch(`http://universities.hipolabs.com/search?${params.toString()}`, {
    signal,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error("University provider failed");
  }

  const data = (await response.json()) as UniversityApiResult[];
  const seen = new Set<string>();

  return data
    .map(normaliseResult)
    .filter((item): item is UniversitySuggestion => Boolean(item))
    .filter((item) => {
      const key = `${item.name.toLowerCase()}-${item.country.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}
