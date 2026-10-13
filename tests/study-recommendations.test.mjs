import assert from "node:assert/strict";
import {
  buildTodayStudyPlan,
  getEffectiveConceptStatus,
  getNextRecallDate,
} from "../src/lib/study/recommendations.ts";

const now = new Date("2026-07-14T12:00:00.000Z");

assert.equal(getNextRecallDate(0, now).toISOString(), "2026-07-15T12:00:00.000Z");
assert.equal(getNextRecallDate(1, now).toISOString(), "2026-07-17T12:00:00.000Z");
assert.equal(getNextRecallDate(2, now).toISOString(), "2026-07-21T12:00:00.000Z");
assert.equal(getNextRecallDate(8, now).toISOString(), "2026-07-21T12:00:00.000Z");

assert.equal(getEffectiveConceptStatus("in_progress", null, now), "explaining");
assert.equal(getEffectiveConceptStatus("clear", "2026-07-15T12:00:00.000Z", now), "needs_recall");
assert.equal(getEffectiveConceptStatus("clear", "2026-07-14T11:00:00.000Z", now), "due_for_review");

const common = {
  roomId: "room-1",
  roomTitle: "Biology",
  sortOrder: 0,
  lastActivityAt: "2026-07-14T10:00:00.000Z",
};

const plan = buildTodayStudyPlan([
  { ...common, id: "new", title: "Beta cells", status: "not_started" },
  { ...common, id: "improving", title: "Glucose uptake", status: "improving" },
  {
    ...common,
    id: "gap",
    title: "Insulin resistance",
    status: "gap_found",
    mainUnresolvedGap: "Connect receptor signalling to GLUT4 translocation.",
  },
  {
    ...common,
    id: "due",
    title: "Glycolysis",
    status: "clear",
    nextReviewAt: "2026-07-14T08:00:00.000Z",
  },
], now);

assert.deepEqual(plan.map((item) => item.conceptId), ["due", "gap", "improving", "new"]);
assert.equal(plan[0].actionType, "Recall from memory");
assert.match(plan[0].href, /mode=recall/);
assert.match(plan[1].reason, /Last weak link/);

console.log("study recommendation tests passed");

