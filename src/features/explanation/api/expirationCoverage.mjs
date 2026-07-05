const coreClaims = [
  "Airways narrow during an asthma flare-up.",
  "Narrowing increases resistance to airflow.",
  "Exhalation raises pressure in the chest or around the airways.",
  "Narrowed airways compress further during exhalation.",
  "Outward airflow becomes slower or limited.",
  "The lungs empty incompletely, causing air trapping.",
  "Air trapping or limited expiration contributes to wheeze, chest tightness, or breathlessness.",
];

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function hasPattern(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

export function isExpirationLimitedSource(sourceMaterial, selectedConcept = "") {
  const source = normalize(sourceMaterial);
  const concept = normalize(selectedConcept);

  return (
    (
      concept.includes("expiration") ||
      concept.includes("exhalation") ||
      concept.includes("breathing out") ||
      concept.includes("expiratory") ||
      concept.includes("air trapping")
    ) &&
    (
      source.includes("asthma") ||
      source.includes("airway") ||
      source.includes("airways") ||
      source.includes("expiration") ||
      source.includes("exhalation") ||
      source.includes("air trapping")
    )
  );
}

function isTopicMismatch(answer) {
  return !hasAny(answer, [
    "airway",
    "airways",
    "asthma",
    "breath",
    "breathing",
    "exhale",
    "exhalation",
    "expiration",
    "wheeze",
    "lungs",
    "airflow",
  ]);
}

export function evaluateExpirationLimitedCoverage(sourceMaterial, explanation, selectedConcept = "Why Expiration is Limited") {
  if (!isExpirationLimitedSource(sourceMaterial, selectedConcept)) return null;

  const answer = normalize(explanation);
  if (isTopicMismatch(answer)) {
    return {
      status: "topic_mismatch",
      clarityScore: null,
      coreClaims,
      coveredClaims: [],
      missingClaims: coreClaims,
      mainGap: "This explanation is about a different topic, not why expiration is limited.",
      socraticQuestion: "How do narrowed airways affect airflow during exhalation?",
      scoreReason: "The latest explanation does not address the selected concept.",
    };
  }

  const covered = [
    {
      claim: coreClaims[0],
      covered:
        hasAny(answer, ["airway", "airways", "bronchi", "bronchiole"]) &&
        (
          hasAny(answer, ["narrow", "tighten", "constrict", "swollen", "swelling", "inflamed", "mucus", "build up"]) ||
          hasPattern(answer, [/muscles? around .*tighten/, /lining .*swollen/])
        ),
    },
    {
      claim: coreClaims[1],
      covered:
        hasAny(answer, ["resistance", "harder for air", "harder to move air", "less space for air", "restrict", "obstruct"]) &&
        hasAny(answer, ["airflow", "air flow", "air to flow", "breathing", "airway", "airways"]),
    },
    {
      claim: coreClaims[2],
      covered:
        hasAny(answer, ["exhal", "expir", "breathing out", "breathe out"]) &&
        hasAny(answer, ["pressure", "chest rises", "inside the chest", "intrathoracic", "thoracic", "chest pressure"]),
    },
    {
      claim: coreClaims[3],
      covered:
        hasAny(answer, ["exhal", "expir", "breathing out", "breathe out"]) &&
        hasAny(answer, ["compress", "collapse", "squeeze", "close", "narrow further", "narrowed airways can compress", "stay open"]) &&
        hasAny(answer, ["airway", "airways", "passage", "tubes"]),
    },
    {
      claim: coreClaims[4],
      covered:
        hasAny(answer, ["air leaves more slowly", "airflow slows", "flow is slower", "slower outward airflow", "limited airflow", "harder to get air out", "breathing out becomes", "difficult to breathe out"]),
    },
    {
      claim: coreClaims[5],
      covered:
        hasAny(answer, ["air trap", "trapped", "remain trapped", "remain in the lungs", "stays in the lungs", "incomplete emptying", "not fully empty", "some air remains", "before the next breath"]),
    },
    {
      claim: coreClaims[6],
      covered:
        hasAny(answer, ["wheeze", "wheezing", "chest tight", "shortness of breath", "breathlessness", "work of breathing", "harder to breathe", "symptoms"]),
    },
  ];

  const coveredClaims = covered.filter((item) => item.covered).map((item) => item.claim);
  const missingClaims = covered.filter((item) => !item.covered).map((item) => item.claim);

  let clarityScore;
  if (missingClaims.length === 0) {
    clarityScore = 94;
  } else if (missingClaims.length === 1) {
    clarityScore = 84;
  } else if (coveredClaims.length >= 3) {
    clarityScore = 68;
  } else {
    clarityScore = 52;
  }

  const status = missingClaims.length === 0 ? "clear" : clarityScore >= 60 ? "improving" : "gap_found";
  const mainGap = missingClaims.length === 0
    ? null
    : missingClaims.includes(coreClaims[3]) || missingClaims.includes(coreClaims[4])
      ? "Explain how narrowed airways compress further during exhalation, slowing outward airflow."
      : missingClaims.includes(coreClaims[5])
        ? "Explain that slower expiration can leave air trapped in the lungs before the next breath."
        : `Explain this missing source-grounded claim: ${missingClaims[0]}`;

  const socraticQuestion = missingClaims.length === 0
    ? null
    : missingClaims.includes(coreClaims[3]) || missingClaims.includes(coreClaims[4])
      ? "What happens to already narrowed airways when pressure rises during exhalation?"
      : "How does limited outward airflow lead to air remaining in the lungs?";

  return {
    status,
    clarityScore,
    coreClaims,
    coveredClaims,
    missingClaims,
    mainGap,
    socraticQuestion,
    scoreReason: missingClaims.length === 0
      ? "The latest explanation covers the complete causal chain from airway narrowing to expiratory compression, air trapping, and symptoms."
      : `The latest explanation covers ${coveredClaims.length} of ${coreClaims.length} core expiration-limitation claims.`,
  };
}
