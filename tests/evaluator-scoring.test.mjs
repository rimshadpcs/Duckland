import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInsulinResistanceCoverage,
  isInsulinResistanceSource,
} from "../src/features/explanation/api/insulinCoverage.mjs";
import {
  evaluateNextTokenPredictionCoverage,
} from "../src/features/explanation/api/nextTokenCoverage.mjs";
import {
  evaluateExpirationLimitedCoverage,
} from "../src/features/explanation/api/expirationCoverage.mjs";

const insulinSource = `
Insulin resistance occurs when target cells in muscle, adipose tissue, and liver respond less effectively to insulin.
In muscle and adipose cells, weaker insulin signalling causes fewer GLUT4 transporters to move to the cell membrane.
This reduces glucose uptake by muscle and adipose tissue, leaving more glucose in the blood.
In the liver, insulin fails to suppress glucose production effectively, so glycogen breakdown and gluconeogenesis may continue.
Pancreatic beta cells initially compensate by producing more insulin, creating compensatory hyperinsulinaemia.
Over time, beta-cell compensation may fail, leading to persistent hyperglycaemia and type 2 diabetes.
Enlarged adipose cells can release free fatty acids and inflammatory signalling molecules that worsen insulin signalling.
`;

const llmSource = `
Large language models process text as tokens. A token can be a word, part of a word, or punctuation.
The model uses the tokens already in the sequence as context to predict the most likely next token.
It adds the predicted token to the sequence and repeats this next-token prediction process.
Repeating the process lets the model generate complete answers, explanations, and code.
`;

const asthmaExpirationSource = `
During an asthma flare-up, airway smooth muscle can tighten, the airway lining becomes inflamed and swollen, and mucus can build up.
These changes narrow the airways and increase resistance to airflow.
Expiration becomes limited because pressure rises in the chest during exhalation and narrowed intrathoracic airways can compress further.
This makes outward airflow slower, so the lungs may not empty completely before the next breath.
Air trapping increases the work of breathing and contributes to wheeze, chest tightness, and shortness of breath.
`;

test("recognises the insulin resistance source and selected concept", () => {
  assert.equal(isInsulinResistanceSource(insulinSource, "Insulin resistance"), true);
});

test("scores a surface insulin-resistance explanation around 60-72", () => {
  const result = evaluateInsulinResistanceCoverage(
    insulinSource,
    "Insulin resistance is when the body does not respond properly to insulin. Glucose remains in the blood, and the pancreas makes more insulin until it can no longer keep up.",
  );

  assert.equal(result.status, "gap_found");
  assert.ok(result.clarityScore >= 60 && result.clarityScore <= 72);
  assert.ok(result.missingClaims.some((claim) => claim.includes("GLUT4")));
  assert.ok(result.missingClaims.some((claim) => claim.includes("liver glucose production")));
});

test("does not award 100 to a good but incomplete first explanation", () => {
  const result = evaluateInsulinResistanceCoverage(
    insulinSource,
    "Insulin resistance occurs when muscle, adipose, and liver cells respond less effectively to insulin. In muscle and adipose cells, weaker insulin signalling causes fewer GLUT4 transporters to move to the cell membrane, so less glucose enters those cells and more remains in the bloodstream. In the liver, insulin becomes less effective at suppressing glucose production. The pancreas initially compensates by producing more insulin, but beta cells may eventually fail.",
  );

  assert.equal(result.status, "gap_found");
  assert.ok(result.clarityScore >= 85 && result.clarityScore <= 92);
  assert.notEqual(result.clarityScore, 100);
  assert.ok(result.missingClaims.some((claim) => claim.includes("glycogen breakdown")));
  assert.ok(result.missingClaims.some((claim) => claim.includes("hyperinsulinaemia")));
  assert.ok(result.missingClaims.some((claim) => claim.includes("adipose cells")));
});

test("allows a perfect score only for full source-grounded coverage", () => {
  const result = evaluateInsulinResistanceCoverage(
    insulinSource,
    "Insulin resistance means muscle, adipose, and liver cells respond less effectively to insulin. Weaker insulin signalling means fewer GLUT4 transporters move to the cell membrane in muscle and adipose tissue, so those tissues take up less glucose. In the liver, insulin fails to suppress glucose production, so glycogen breakdown and gluconeogenesis can continue. Beta cells in the pancreas initially compensate by producing more insulin, causing compensatory hyperinsulinaemia. Enlarged adipose cells can release free fatty acids and inflammatory signalling molecules that worsen insulin signalling. Eventually beta-cell compensation may fail, causing persistent hyperglycaemia and type 2 diabetes.",
  );

  assert.equal(result.status, "clear");
  assert.ok(result.clarityScore >= 98 && result.clarityScore <= 100);
  assert.equal(result.missingClaims.length, 0);
  assert.equal(result.mainGap, null);
  assert.equal(result.socraticQuestion, null);
});

test("scores a shallow next-token explanation as improving", () => {
  const result = evaluateNextTokenPredictionCoverage(
    llmSource,
    "LLMs work by predicting what word should come next in a sentence. They learn this from reading lots of text, so they can answer questions, write code, and generate explanations.",
    "Next-token prediction",
  );

  assert.ok(result);
  assert.equal(result.status, "improving");
  assert.ok(result.clarityScore >= 60 && result.clarityScore <= 74);
  assert.ok(result.missingClaims.some((claim) => claim.includes("tokens rather than only whole words")));
  assert.ok(result.missingClaims.some((claim) => claim.includes("existing token sequence")));
  assert.ok(result.missingClaims.some((claim) => claim.includes("repeats the process")));
});

test("scores a strong next-token explanation as clear", () => {
  const result = evaluateNextTokenPredictionCoverage(
    llmSource,
    "An LLM processes text as tokens, which can be words, parts of words, or punctuation. It uses the tokens already in the sequence as context to predict the most likely next token. It adds that token and repeats the process, which lets it generate complete answers, explanations, or code.",
    "Next-token prediction",
  );

  assert.ok(result);
  assert.equal(result.status, "clear");
  assert.ok(result.clarityScore >= 90 && result.clarityScore <= 100);
  assert.equal(result.missingClaims.length, 0);
});

test("scores only the latest next-token explanation", () => {
  const result = evaluateNextTokenPredictionCoverage(
    llmSource,
    "LLMs predict the next word from training data.",
    "Next-token prediction",
  );

  assert.ok(result);
  assert.notEqual(result.status, "clear");
  assert.ok(result.clarityScore !== null && result.clarityScore <= 74);
});

test("detects next-token topic mismatch", () => {
  const result = evaluateNextTokenPredictionCoverage(
    llmSource,
    "Photosynthesis converts light energy into chemical energy in plants.",
    "Next-token prediction",
  );

  assert.ok(result);
  assert.equal(result.status, "topic_mismatch");
  assert.equal(result.clarityScore, null);
});

test("treats a plain-English asthma expiration mechanism as clear", () => {
  const result = evaluateExpirationLimitedCoverage(
    asthmaExpirationSource,
    "During an asthma flare-up, the muscles around the airways tighten, the airway lining becomes inflamed and swollen, and mucus can build up. These changes narrow the airway and increase resistance to airflow. Breathing out becomes especially difficult because pressure inside the chest rises during exhalation. Healthy airways stay open enough for air to leave, but narrowed airways can compress further as the person breathes out. Air leaves more slowly, so some can remain trapped in the lungs before the next breath begins. This air trapping increases the work of breathing and contributes to wheeze, chest tightness, and shortness of breath.",
    "Why Expiration is Limited",
  );

  assert.ok(result);
  assert.equal(result.status, "clear");
  assert.equal(result.clarityScore, 94);
  assert.equal(result.missingClaims.length, 0);
  assert.equal(result.mainGap, null);
  assert.equal(result.socraticQuestion, null);
});
