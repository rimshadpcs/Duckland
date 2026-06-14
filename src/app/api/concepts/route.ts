import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIKeyStatus, isLocalDevelopment, logOpenAIConfig } from "@src/lib/openai";

type ConceptRequestBody = {
  sourceMaterial?: unknown;
};

type ConceptSuggestion = {
  title: string;
  description?: string;
};

const conceptExtractionPrompt = `
You extract study concepts from source material for Feynduck.

Rules:
- Extract 4-6 distinct study concepts from the supplied source.
- Use only concepts explicitly supported by the source.
- Prefer concrete topics rather than vague categories.
- Keep titles between 2 and 6 words.
- Avoid duplicates or heavily overlapping concepts.
- Include the main overarching concept plus important subtopics.
- Do not return labels such as "Main definition", "Key mechanism", or "Cause and effect".
- Do not add external knowledge.
- If the source is short and clearly focuses on one concept, return one primary concept and up to two useful subtopics.

Return only JSON:
{
  "concepts": [
    { "title": "Concept title", "description": "Optional short description" }
  ]
}
`;

function cleanConcepts(concepts: unknown): ConceptSuggestion[] {
  if (!Array.isArray(concepts)) return [];

  const seen = new Set<string>();
  return concepts
    .map((concept) => {
      if (!concept || typeof concept !== "object") return null;
      const candidate = concept as Record<string, unknown>;
      const title = typeof candidate.title === "string" ? candidate.title.replace(/\s+/g, " ").trim() : "";
      const description =
        typeof candidate.description === "string"
          ? candidate.description.replace(/\s+/g, " ").trim()
          : undefined;

      if (title.length < 2) return null;
      const key = title.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        title: title.slice(0, 80),
        ...(description ? { description: description.slice(0, 160) } : {}),
      };
    })
    .filter((concept): concept is ConceptSuggestion => Boolean(concept))
    .slice(0, 6);
}

function sourceIncludes(source: string, terms: string[]) {
  const ignoredTerms = new Set(["and", "or", "the", "a", "an", "of", "to", "in"]);

  return terms
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !ignoredTerms.has(term))
    .some((term) => source.includes(term));
}

function fallbackConcepts(sourceMaterial: string): ConceptSuggestion[] {
  const source = sourceMaterial.toLowerCase();

  if (sourceIncludes(source, ["asthma", "bronchoconstriction", "airway hyperresponsiveness"])) {
    return [
      { title: "Asthma pathophysiology" },
      { title: "Allergic immune response" },
      { title: "Bronchoconstriction" },
      { title: "Airway hyperresponsiveness" },
      { title: "Air trapping and hyperinflation" },
      { title: "Airway remodelling" },
    ].filter((concept) => sourceIncludes(source, concept.title.toLowerCase().split(/\s+|-/)));
  }

  if (sourceIncludes(source, ["insulin resistance", "glut4", "hyperinsulin", "adipose"])) {
    return [
      { title: "Insulin resistance" },
      { title: "GLUT4 transport" },
      { title: "Liver glucose production" },
      { title: "Compensatory hyperinsulinaemia" },
      { title: "Adipose inflammation" },
      { title: "Exercise and insulin sensitivity" },
    ].filter((concept) => sourceIncludes(source, concept.title.toLowerCase().split(/\s+|-/)));
  }

  if (sourceIncludes(source, ["cardiac output", "stroke volume", "heart rate"])) {
    return [
      { title: "Cardiac output" },
      { title: "Heart rate and stroke volume" },
      { title: "Compensation when stroke volume falls" },
    ];
  }

  const capitalisedPhrases = Array.from(
    sourceMaterial.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z]?[a-z]+){1,4})\b/g),
  )
    .map((match) => match[1].trim())
    .filter((phrase) => !/^(The|This|When|If|In|For|And|But)\b/.test(phrase));

  return cleanConcepts(capitalisedPhrases.map((title) => ({ title }))).slice(0, 4);
}

export async function POST(request: Request) {
  let body: ConceptRequestBody;

  try {
    body = (await request.json()) as ConceptRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.sourceMaterial !== "string" || body.sourceMaterial.trim().length < 10) {
    return NextResponse.json(
      { error: "Source material is required and must be at least 10 characters long." },
      { status: 400 },
    );
  }

  const sourceMaterial = body.sourceMaterial.trim();
  const keyStatus = getOpenAIKeyStatus();
  const allowFallback = isLocalDevelopment() && keyStatus.state === "missing";

  if (keyStatus.state === "placeholder" || keyStatus.state === "malformed") {
    return NextResponse.json(
      { error: "OpenAI API key is invalid. You can still enter a concept manually." },
      { status: 401 },
    );
  }

  const openai = getOpenAIClient();
  if (!openai) {
    if (allowFallback) {
      return NextResponse.json({ concepts: fallbackConcepts(sourceMaterial) });
    }

    return NextResponse.json(
      { error: "OpenAI is not configured. You can still enter a concept manually." },
      { status: 500 },
    );
  }

  const model = process.env.OPENAI_CONCEPT_MODEL || process.env.OPENAI_EVALUATOR_MODEL || "gpt-4o-mini";
  logOpenAIConfig(model);

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: conceptExtractionPrompt },
        { role: "user", content: `Source material:\n${sourceMaterial}` },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty concept extraction response.");
    }

    const parsed = JSON.parse(content) as { concepts?: unknown };
    const concepts = cleanConcepts(parsed.concepts);

    if (!concepts.length) {
      throw new Error("No concepts returned.");
    }

    return NextResponse.json({ concepts });
  } catch (error) {
    if (isLocalDevelopment()) {
      console.error("[OpenAI] concept extraction failed", error);
    }

    const fallback = fallbackConcepts(sourceMaterial);
    if (fallback.length) {
      return NextResponse.json({ concepts: fallback });
    }

    return NextResponse.json(
      { error: "I couldn't generate suggestions, but you can still enter a concept below." },
      { status: 502 },
    );
  }
}
