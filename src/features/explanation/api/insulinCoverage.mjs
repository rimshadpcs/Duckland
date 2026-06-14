const GLUT4_GAP =
  "weaker insulin signalling -> fewer GLUT4 transporters move to the membrane -> reduced glucose uptake";
const LIVER_GAP = "continued liver glucose production";

function lower(value) {
  return value.toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function hasAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

export function isInsulinResistanceSource(notes, selectedConcept) {
  const source = lower(notes);
  const concept = lower(selectedConcept || "");

  return (
    concept.includes("insulin resistance") &&
    source.includes("insulin resistance") &&
    source.includes("glut4") &&
    source.includes("liver") &&
    source.includes("glucose")
  );
}

export function evaluateInsulinResistanceCoverage(notes, explanation) {
  const source = lower(notes);
  const answer = lower(explanation);

  const centralClaims = [
    {
      claim: "Target cells respond less effectively to insulin.",
      applies: source.includes("respond less") || source.includes("resistance"),
      covered:
        hasAny(answer, ["respond less", "less strongly", "less effective", "does not respond properly", "resist"]) &&
        answer.includes("insulin"),
    },
    {
      claim: "Weaker insulin signalling causes fewer GLUT4 transporters to reach the cell membrane.",
      applies: source.includes("glut4") && source.includes("membrane"),
      covered:
        answer.includes("glut4") &&
        hasAny(answer, ["membrane", "cell surface"]) &&
        hasAny(answer, ["weaker", "reduced", "less", "fewer"]),
    },
    {
      claim: "Reduced GLUT4 movement lowers glucose uptake by muscle and adipose tissue.",
      applies: source.includes("glucose") && (source.includes("muscle") || source.includes("adipose")),
      covered:
        hasAny(answer, ["glucose uptake", "glucose enters", "glucose enter", "less glucose", "reduced uptake"]) &&
        hasAny(answer, ["muscle", "adipose", "fat"]),
    },
    {
      claim: "Insulin fails to suppress liver glucose production effectively.",
      applies: source.includes("liver") && hasAny(source, ["production", "release", "output", "suppress"]),
      covered:
        answer.includes("liver") &&
        answer.includes("glucose") &&
        hasAny(answer, ["production", "release", "output", "suppress"]),
    },
    {
      claim: "The liver may continue glycogen breakdown and gluconeogenesis.",
      applies: source.includes("glycogen") || source.includes("gluconeogenesis"),
      covered:
        answer.includes("liver") &&
        (source.includes("glycogen") ? answer.includes("glycogen") : true) &&
        (source.includes("gluconeogenesis") ? answer.includes("gluconeogenesis") : true),
    },
    {
      claim: "Pancreatic beta cells initially compensate by producing more insulin.",
      applies: source.includes("pancreas") || source.includes("beta"),
      covered:
        hasAny(answer, ["pancreas", "beta cell", "beta-cell", "beta cells"]) &&
        hasAny(answer, ["compensat", "more insulin", "producing more insulin", "release more insulin"]),
    },
    {
      claim: "Compensation produces compensatory hyperinsulinaemia.",
      applies: source.includes("hyperinsulin"),
      covered: hasAny(answer, ["hyperinsulin", "high insulin", "elevated insulin", "excess insulin"]),
    },
    {
      claim: "Beta-cell compensation may eventually fail, leading to persistent hyperglycaemia and type 2 diabetes.",
      applies: source.includes("type 2") || source.includes("hypergly") || hasAll(source, ["beta", "fail"]),
      covered:
        hasAny(answer, ["beta", "pancreas"]) &&
        hasAny(answer, ["fail", "cannot keep up", "can't keep up", "eventually"]) &&
        hasAny(answer, ["type 2", "diabetes", "hypergly", "bloodstream", "blood glucose"]),
    },
    {
      claim: "Enlarged adipose cells can release free fatty acids and inflammatory signals that worsen insulin signalling.",
      applies: source.includes("free fatty") || source.includes("inflammatory") || source.includes("adipose tissue"),
      covered:
        hasAny(answer, ["adipose", "fat"]) &&
        hasAny(answer, ["free fatty", "fatty acids", "inflammatory", "inflammation"]) &&
        hasAny(answer, ["worsen", "weaken", "impair", "signalling", "signaling"]),
    },
  ].filter((item) => item.applies);

  const coveredClaims = centralClaims.filter((item) => item.covered).map((item) => item.claim);
  const missingClaims = centralClaims.filter((item) => !item.covered).map((item) => item.claim);
  const covered = coveredClaims.length;
  const total = centralClaims.length;

  let clarityScore;
  if (missingClaims.length === 0) {
    clarityScore = 100;
  } else if (covered >= total - 1) {
    clarityScore = 95;
  } else if (covered >= total - 3) {
    clarityScore = 88;
  } else if (
    coveredClaims.includes("Target cells respond less effectively to insulin.") &&
    coveredClaims.includes("Pancreatic beta cells initially compensate by producing more insulin.")
  ) {
    clarityScore = 66;
  } else if (covered >= 2) {
    clarityScore = 65;
  } else {
    clarityScore = 52;
  }

  if (clarityScore === 100 && missingClaims.length > 0) {
    throw new Error("A perfect score cannot contain missing claims.");
  }

  if (clarityScore === 100 && coveredClaims.length < centralClaims.length) {
    clarityScore = 95;
  }

  const status = missingClaims.length === 0 ? "clear" : "gap_found";
  const firstMissing = missingClaims[0] || null;
  let mainGap = firstMissing;
  let socraticQuestion = firstMissing
    ? "Can you explain that missing source-level step in your own words?"
    : null;

  if (firstMissing?.includes("GLUT4")) {
    mainGap =
      "You did not explain how weaker insulin signalling reduces GLUT4 movement to the membrane and lowers glucose uptake.";
    socraticQuestion =
      "How does weaker insulin signalling lead to fewer GLUT4 transporters at the membrane and less glucose entering muscle and adipose cells?";
  } else if (firstMissing?.includes("liver")) {
    mainGap =
      "You did not explain how insulin resistance affects liver glucose production.";
    socraticQuestion =
      "What happens to liver glucose production when insulin no longer suppresses it effectively?";
  } else if (firstMissing?.includes("glycogen")) {
    mainGap =
      "You explained liver glucose production, but omitted the source details about glycogen breakdown and gluconeogenesis.";
    socraticQuestion =
      "Which liver processes continue when insulin fails to suppress glucose production?";
  } else if (firstMissing?.includes("hyperinsulinaemia")) {
    mainGap =
      "You mentioned compensation, but did not name compensatory hyperinsulinaemia from the source.";
    socraticQuestion =
      "What is the high-insulin compensation called in the source?";
  } else if (firstMissing?.includes("adipose")) {
    mainGap =
      "You omitted the source detail that enlarged adipose cells release fatty acids and inflammatory signals that worsen insulin signalling.";
    socraticQuestion =
      "How can enlarged adipose cells worsen insulin signalling according to the source?";
  }

  return {
    status,
    clarityScore,
    scoreReason:
      status === "clear"
        ? "The latest explanation covers every central source-grounded claim for insulin resistance."
        : `The latest explanation covers ${covered} of ${total} central source-grounded claims for insulin resistance.`,
    coveredClaims,
    missingClaims,
    mainGap,
    socraticQuestion,
    resolvedGaps: coveredClaims.some((claim) => claim.includes("GLUT4"))
      ? [GLUT4_GAP, ...(coveredClaims.some((claim) => claim.includes("liver")) ? [LIVER_GAP] : [])]
      : [],
  };
}
