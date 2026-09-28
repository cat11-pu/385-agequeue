// agerun.js：按处理预算处理事件，处理不动的压进待处理账，收尾时把账做完。
//
// 事件三种：
//   add  带 task（正整数任务号）与 prio（正整数优先级），同一任务号在等待表里只能出现一次；
//   tick 不带参数，把当前优先级最低的任务提一档（并列取先加入的），老化次数加一；
//   pick 不带参数，取出当前优先级最高的任务（并列取先加入的），任务号记进取出清单并移出等待表。
//
// 每条事件花一次共用处理预算；预算用尽后，没处理的（连同重放时已处理过的）连着压账。
// state.applied 记录本步真正处理过的事件 id，重放不重复处理、不重复花预算。
import { lowestOf, topOf } from "./age.js";

const CODES = {
  badTask: "E_BAD_TASK",
  badPrio: "E_BAD_PRIO",
  dup: "E_DUP_TASK",
  empty: "E_EMPTY",
  badEvent: "E_BAD_EVENT"
};

function code(spec, key, fallback) {
  const map = {
    badTask: "bad_task_code",
    badPrio: "bad_prio_code",
    dup: "dup_code",
    empty: "empty_code",
    badEvent: "event_error_code"
  };
  const name = map[key];
  return spec && typeof spec[name] === "string" && spec[name] ? spec[name] : fallback;
}

function fail(spec, key) {
  const err = new Error(key);
  err.code = code(spec, key, CODES[key]);
  throw err;
}

function isPosInt(value) {
  return Number.isInteger(value) && value > 0;
}

function cloneState(state) {
  const src = state || {};
  return {
    waiting: (src.waiting || []).map(function (row) { return [row[0], row[1], row[2]]; }),
    pops: (src.pops || []).slice(),
    ticks: src.ticks || 0,
    ledger: (src.ledger || []).map(function (row) {
      const copy = [row[0], row[1] === undefined ? null : row[1], row[2] === undefined ? null : row[2]];
      if (row && row.id !== undefined) copy.id = row.id;
      return copy;
    }),
    applied: (src.applied || []).slice()
  };
}

// 结构与字段校验（add 先验任务号再验优先级）；不合法直接抛错，调用前的草稿状态不会落地。
function inspectKind(row, spec) {
  if (!Array.isArray(row) || (row[0] !== "add" && row[0] !== "tick" && row[0] !== "pick")) {
    fail(spec, "badEvent");
  }
  if (row[0] === "add") {
    if (!isPosInt(row[1])) fail(spec, "badTask");
    if (!isPosInt(row[2])) fail(spec, "badPrio");
  }
  return row[0];
}

function toRow(event) {
  const kind = event && typeof event === "object" ? event.kind : event;
  if (kind === "add") {
    const row = ["add", event.task === undefined ? null : event.task, event.prio === undefined ? null : event.prio];
    if (event.id !== undefined) row.id = event.id;
    return row;
  }
  const row = [kind, null, null];
  if (event && typeof event === "object" && event.id !== undefined) row.id = event.id;
  return row;
}

// 把一条校验过的事件应用到状态上；语义冲突（重复加入 / 空表老化或取出）同样抛错。
function applyRow(row, state, spec) {
  const kind = inspectKind(row, spec);
  if (kind === "add") {
    const task = row[1];
    const prio = row[2];
    for (let i = 0; i < state.waiting.length; i++) {
      if (state.waiting[i][0] === task) fail(spec, "dup");
    }
    state.waiting.push([task, prio, prio]);
    return;
  }
  if (kind === "tick") {
    const idx = lowestOf(state.waiting);
    if (idx < 0) fail(spec, "empty");
    state.waiting[idx][2] += 1;
    state.ticks += 1;
    return;
  }
  const idx = topOf(state.waiting);
  if (idx < 0) fail(spec, "empty");
  state.pops.push(state.waiting[idx][0]);
  state.waiting.splice(idx, 1);
}

// 从账本头部起处理：已处理过的重放项不花预算；其余每条花一次预算，
// 预算用尽后的剩余行原样压在账上。账本始终排在新事件前面（旧账先还）。
function drain(state, ledger, budget, spec) {
  let served = 0;
  for (let i = 0; i < ledger.length; i++) {
    const row = ledger[i];
    const already = row.id !== undefined && state.applied.indexOf(row.id) >= 0;
    if (!already) {
      if (served >= budget) {
        state.ledger = ledger.slice(i).map(function (left) {
          const copy = [left[0], left[1], left[2]];
          if (left.id !== undefined) copy.id = left.id;
          return copy;
        });
        return served;
      }
      applyRow(row, state, spec);
      if (row.id !== undefined) state.applied.push(row.id);
      served += 1;
    }
  }
  state.ledger = [];
  return served;
}

export function step(spec) {
  const work = spec || {};
  const state = cloneState(work.state);
  const events = Array.isArray(work.events) ? work.events : [];
  const budget = Number.isFinite(work.budget) && work.budget >= 0 ? Math.floor(work.budget) : 0;
  const rows = state.ledger.concat(events.map(toRow));
  const served = drain(state, rows, budget, work);
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1], row[2]]; }),
    judged: served,
    judged_bound: events.length
  };
}

export function close(spec) {
  const work = spec || {};
  const state = cloneState(work.state);
  const rows = state.ledger;
  state.ledger = [];
  let catchup = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const already = row.id !== undefined && state.applied.indexOf(row.id) >= 0;
    if (already) continue;
    applyRow(row, state, work);
    if (row.id !== undefined) state.applied.push(row.id);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
