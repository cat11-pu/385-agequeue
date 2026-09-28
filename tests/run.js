import assert from "node:assert";
import fs from "node:fs";
import { lowestOf, topOf } from "../age.js";
import { step, close } from "../agerun.js";
import { render } from "../app.js";

function spec(events, budget, state) {
  return {
    budget: budget,
    state: state || { waiting: [], pops: [], ticks: 0, ledger: [], applied: [] },
    events: events,
    bad_task_code: "E_BAD_TASK", bad_prio_code: "E_BAD_PRIO",
    dup_code: "E_DUP_TASK", empty_code: "E_EMPTY",
    event_error_code: "E_BAD_EVENT"
  };
}

function codeOf(fn) {
  try { fn(); return "没有报错"; } catch (e) { return e && e.code ? e.code : String(e && e.message); }
}

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("lowestOf/topOf 取极值，并列取先加入，空表给负一", () => {
  assert.strictEqual(lowestOf([]), -1);
  assert.strictEqual(topOf([]), -1);
  const waiting = [[1, 5, 5], [2, 9, 9], [3, 3, 3]];
  assert.strictEqual(lowestOf(waiting), 2);
  assert.strictEqual(topOf(waiting), 1);
  const tied = [[1, 5, 5], [2, 5, 5]];
  assert.strictEqual(lowestOf(tied), 0);
  assert.strictEqual(topOf(tied), 0);
});

check("step 按预算处理，用尽后连着压账；close 把账做完", () => {
  const events = [
    { id: 1, kind: "add", task: 1, prio: 5 },
    { id: 2, kind: "add", task: 2, prio: 9 },
    { id: 3, kind: "tick" },
    { id: 4, kind: "pick" },
    { id: 5, kind: "pick" }
  ];
  const first = step(spec(events, 2));
  assert.strictEqual(first.served, 2);
  assert.strictEqual(first.ledger_before, 3);
  assert.deepStrictEqual(first.ledger, [["tick", null, null], ["pick", null, null], ["pick", null, null]]);
  const closed = close(spec(events, 2, first.state));
  assert.strictEqual(closed.catchup, 3);
  assert.deepStrictEqual(closed.state.waiting, []);
  assert.deepStrictEqual(closed.state.pops, [2, 1]);
  assert.strictEqual(closed.state.ticks, 1);
  assert.strictEqual(closed.state.ledger.length, 0);
});

check("老化提最低一档，取出取最高；并列取先加入", () => {
  const events = [
    { id: 1, kind: "add", task: 1, prio: 5 },
    { id: 2, kind: "add", task: 2, prio: 5 },
    { id: 3, kind: "tick" },
    { id: 4, kind: "pick" }
  ];
  const first = step(spec(events, 4));
  const closed = close(spec(events, 4, first.state));
  assert.deepStrictEqual(closed.state.pops, [1]);
  assert.deepStrictEqual(closed.state.waiting.map((r) => [r[0], r[2]]), [[2, 5]]);
});

check("非法事件、任务号、优先级、重复加入、空表操作报各自错码（先校验）", () => {
  const run = (events, state) => step(spec(events, 1, state));
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "peek", task: 1 }])), "E_BAD_EVENT");
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "add", task: 0, prio: 5 }])), "E_BAD_TASK");
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "add", task: 1, prio: -2 }])), "E_BAD_PRIO");
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "add", task: 0, prio: 0 }])), "E_BAD_TASK");
  const seeded = { waiting: [[1, 5, 5]], pops: [], ticks: 0, ledger: [], applied: [] };
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "add", task: 1, prio: 8 }], seeded)), "E_DUP_TASK");
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "tick" }])), "E_EMPTY");
  assert.strictEqual(codeOf(() => run([{ id: 1, kind: "pick" }])), "E_EMPTY");
});

check("render 保住十八键契约与七条机检断言", () => {
  const sample = JSON.parse(fs.readFileSync(new URL("../sample/queues.json", import.meta.url), "utf8"));
  const view = render(sample);
  const keys = Object.keys(view);
  assert.strictEqual(keys.length, 18);
  assert.deepStrictEqual(keys.slice(0, 3), ["waiting", "pops", "ticks"]);
  assert.strictEqual(keys[keys.length - 2], "count_events");
  assert.strictEqual(keys[keys.length - 1], "tail");
  assert.strictEqual(view.full_diff, 0);
  assert.strictEqual(view.pair_differs, true);
  assert.ok(view.ledger_before > 0);
  assert.strictEqual(view.ledger_after, 0);
  assert.strictEqual(view.mid_differs, true);
  assert.strictEqual(view.closed_equal, true);
  assert.strictEqual(view.replay_new, 0);
  assert.ok(view.judged <= view.judged_bound);
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
