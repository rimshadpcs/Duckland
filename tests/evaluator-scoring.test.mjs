import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInsulinResistanceCoverage,
  isInsulinResistanceSource,
} from "../src/features/explanation/api/insulinCoverage.mjs";

const insulinSource = `
Insulin resistance occurs when target cells in muscle, adipose tissue, and liver respond less effectively to insulin.
In muscle and adipose cells, weaker insulin signalling causes fewer GLUT4 transporters to move to the cell membrane.
This reduces glucose uptake by muscle and adipose tissue, leaving more glucose in the blood.
In the liver, insulin fails to suppress glucose production effectively, so glycogen breakdown and gluconeogenesis may continue.
Pancreatic beta cells initially compensate by producing more insulin, creating compensatory hyperinsulinaemia.
Over time, beta-cell compensation may fail, leading to persistent hyperglycaemia and type 2 diabetes.
Enlarged adipose cells can release free fatty acids and inflammatory signalling molecules that worsen insulin signalling.
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
