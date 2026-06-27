const coreClaims = [
  "LLMs process text as tokens rather than only whole words.",
  "Tokens may be words, parts of words, or punctuation.",
  "The model uses the existing token sequence as context.",
  "The model predicts the next token.",
  "The model adds the predicted token and repeats the process to build a full output.",
];

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

export function isNextTokenPredictionSource(sourceMaterial, selectedConcept = "") {
  const source = normalize(sourceMaterial);
  const concept = normalize(selectedConcept);

  return (
    (concept.includes("next-token") ||
      concept.includes("next token") ||
      concept.includes("role of predictions") ||
      concept.includes("prediction")) &&
    source.includes("large language model") &&
    source.includes("token") &&
    source.includes("next token")
  );
}

function isTopicMismatch(answer) {
  return !hasAny(answer, ["llm", "language model", "model", "token", "word", "predict"]);
}

export function evaluateNextTokenPredictionCoverage(sourceMaterial, explanation, selectedConcept = "Next-token prediction") {
  if (!isNextTokenPredictionSource(sourceMaterial, selectedConcept)) return null;

  const answer = normalize(explanation);
  if (isTopicMismatch(answer)) {
    return {
      status: "topic_mismatch",
      clarityScore: null,
      coreClaims,
      coveredClaims: [],
      missingClaims: coreClaims,
      mainGap: "This explanation is about a different topic, not next-token prediction.",
      socraticQuestion: "How does a language model use tokens to predict what comes next?",
      scoreReason: "The latest explanation does not address the selected concept.",
    };
  }

  const covered = [
    {
      claim: coreClaims[0],
      covered:
        answer.includes("token") &&
        !/only whole words|whole words only/.test(answer),
    },
    {
      claim: coreClaims[1],
      covered:
        answer.includes("token") &&
        hasAny(answer, ["part of a word", "parts of words", "punctuation", "subword", "word pieces", "word-piece"]),
    },
    {
      claim: coreClaims[2],
      covered:
        hasAny(answer, ["context", "preceding token", "previous token", "tokens already", "existing token", "sequence so far", "already in the sequence"]),
    },
    {
      claim: coreClaims[3],
      covered:
        hasAny(answer, ["predict"]) &&
        hasAny(answer, ["next token", "following token", "token comes next", "what token"]),
    },
    {
      claim: coreClaims[4],
      covered:
        hasAny(answer, ["repeat", "repeated", "again", "iteratively", "one token at a time"]) &&
        hasAny(answer, ["complete answer", "full output", "complete response", "generate text", "build", "construct"]),
    },
  ];

  const coveredClaims = covered.filter((item) => item.covered).map((item) => item.claim);
  const missingClaims = covered.filter((item) => !item.covered).map((item) => item.claim);

  let clarityScore;
  if (missingClaims.length === 0) {
    clarityScore = 95;
  } else if (missingClaims.length === 1) {
    clarityScore = 84;
  } else if (missingClaims.length <= 3 || hasAny(answer, ["predicting what word", "predict the next word", "word should come next"])) {
    clarityScore = 68;
  } else {
    clarityScore = 55;
  }

  const status = missingClaims.length === 0 ? "clear" : clarityScore >= 60 ? "improving" : "gap_found";
  const missesContext = missingClaims.includes(coreClaims[2]);
  const missesRepeat = missingClaims.includes(coreClaims[4]);
  const missesTokens = missingClaims.includes(coreClaims[0]) || missingClaims.includes(coreClaims[1]);

  const mainGap = missingClaims.length === 0
    ? null
    : missesContext || missesRepeat
      ? "Explain how an LLM uses the existing token sequence as context and repeatedly predicts the next token to build a complete response."
      : missesTokens
        ? "Explain that LLMs work with tokens, which can be words, parts of words, or punctuation, not just whole words."
        : `Explain this missing source-grounded claim: ${missingClaims[0]}`;

  const socraticQuestion = missingClaims.length === 0
    ? null
    : missesContext || missesRepeat
      ? "After the model predicts one token, what does it do with that token before predicting the next one?"
      : "What counts as a token in the source: only full words, or smaller pieces too?";

  return {
    status,
    clarityScore,
    coreClaims,
    coveredClaims,
    missingClaims,
    mainGap,
    socraticQuestion,
    scoreReason: missingClaims.length === 0
      ? "The latest explanation covers the complete next-token prediction mechanism from the source."
      : `The latest explanation covers ${coveredClaims.length} of ${coreClaims.length} core next-token prediction claims.`,
  };
}
