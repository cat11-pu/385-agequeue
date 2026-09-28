// age.js：在等待表里找当前优先级最低 / 最高的行下标。
// 等待表一行是 [任务号, 加入时优先级, 当前优先级]，按加入顺序排列；
// 并列时取最前面（先加入的），空表给 -1。
export function lowestOf(waiting) {
  if (!Array.isArray(waiting) || waiting.length === 0) return -1;
  let idx = 0;
  for (let i = 1; i < waiting.length; i++) {
    if (waiting[i][2] < waiting[idx][2]) idx = i;
  }
  return idx;
}

export function topOf(waiting) {
  if (!Array.isArray(waiting) || waiting.length === 0) return -1;
  let idx = 0;
  for (let i = 1; i < waiting.length; i++) {
    if (waiting[i][2] > waiting[idx][2]) idx = i;
  }
  return idx;
}
