import assert from "node:assert";
import { lowestOf, topOf } from "../age.js";
import { step, close } from "../agerun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { waiting: [], pops: [], ticks: 0, ledger: [], applied: [] },
  events: [{ id: 1, kind: "add", task: 1, prio: 5 }],
  bad_task_code: "E_BAD_TASK", bad_prio_code: "E_BAD_PRIO",
  dup_code: "E_DUP_TASK", empty_code: "E_EMPTY",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("lowestOf returns a number", () => {
  assert.strictEqual(typeof lowestOf([[1, 5, 5]]), "number");
});

check("topOf returns a number", () => {
  assert.strictEqual(typeof topOf([[1, 5, 5]]), "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
