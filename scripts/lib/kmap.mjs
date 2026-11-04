// kmap 元件：解析 ```kmap 區塊的 YAML、驗證圈法、產生 HTML。
// 規格見 AGENTS.md 第 7.4 節。修改這裡的行為時，要同步更新 AGENTS.md。

import { load as parseYaml } from 'js-yaml';

const GRAY = { 1: [0, 1], 2: [0, 1, 3, 2] };
const MAX_GROUP_COLORS = 6;

export class KmapError extends Error {}

/** 解析並驗證 kmap 定義，回傳正規化後的資料（含自動產生的項）。 */
export function parseKmap(source) {
  let spec;
  try {
    spec = parseYaml(source) ?? {};
  } catch (e) {
    throw new KmapError(`kmap 的 YAML 格式錯誤：${e.reason ?? e.message}`);
  }
  if (typeof spec !== 'object' || Array.isArray(spec)) throw new KmapError('kmap 內容必須是 YAML 物件');

  const allowed = new Set(['vars', 'ones', 'dontcares', 'mode', 'groups', 'partial', 'caption']);
  for (const key of Object.keys(spec)) {
    if (!allowed.has(key)) throw new KmapError(`kmap 不認得欄位「${key}」，可用欄位：${[...allowed].join(', ')}`);
  }

  const vars = spec.vars;
  if (!Array.isArray(vars) || vars.length < 2 || vars.length > 4) throw new KmapError('vars 必須是 2–4 個變數名稱的陣列');
  if (!vars.every((v) => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(v))) throw new KmapError('vars 的變數名稱只能用英文字母開頭');
  if (new Set(vars).size !== vars.length) throw new KmapError('vars 有重複的變數名稱');

  const n = vars.length;
  const size = 1 << n;
  const intList = (value, name) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new KmapError(`${name} 必須是陣列`);
    for (const x of value) {
      if (!Number.isInteger(x) || x < 0 || x >= size) throw new KmapError(`${name} 裡的 ${x} 不是 0–${size - 1} 的整數`);
    }
    if (new Set(value).size !== value.length) throw new KmapError(`${name} 有重複的格子編號`);
    return value;
  };

  const ones = intList(spec.ones, 'ones');
  const dontcares = intList(spec.dontcares, 'dontcares');
  const overlap = ones.filter((x) => dontcares.includes(x));
  if (overlap.length) throw new KmapError(`格子 ${overlap.join(', ')} 同時出現在 ones 和 dontcares`);

  const mode = spec.mode ?? 'sop';
  if (mode !== 'sop' && mode !== 'pos') throw new KmapError('mode 只能是 sop 或 pos');

  const value = Array.from({ length: size }, (_, m) => (ones.includes(m) ? 1 : dontcares.includes(m) ? 'x' : 0));
  const target = mode === 'sop' ? 1 : 0;

  const rawGroups = spec.groups ?? [];
  if (!Array.isArray(rawGroups)) throw new KmapError('groups 必須是陣列，每一圈寫成格子編號的陣列，例如 - [0, 1, 4, 5]');
  if (rawGroups.length > MAX_GROUP_COLORS) throw new KmapError(`最多 ${MAX_GROUP_COLORS} 圈；圈數更多時請拆成多張圖`);

  const groups = rawGroups.map((cells, i) => {
    const label = `第 ${i + 1} 圈`;
    intList(cells, `groups ${label}`);
    if (cells.length === 0) throw new KmapError(`${label}是空的`);
    const bad = cells.filter((m) => value[m] !== target && value[m] !== 'x');
    if (bad.length) throw new KmapError(`${label}包含不能圈的格子 ${bad.join(', ')}（${mode} 模式只能圈 ${target} 和無關項）`);
    if (!cells.some((m) => value[m] === target)) throw new KmapError(`${label}只圈到無關項，沒有意義`);
    const cube = toCube(cells, n);
    if (!cube) throw new KmapError(`${label} [${cells.join(', ')}] 不是合法的圈：格數必須是 2 的冪次，且要形成相鄰的矩形`);
    return { cells: [...cells].sort((a, b) => a - b), cube, term: cubeToTerm(cube, vars, mode) };
  });

  const partial = spec.partial ?? false;
  if (typeof partial !== 'boolean') throw new KmapError('partial 只能是 true 或 false');
  if (groups.length && !partial) {
    const covered = new Set(groups.flatMap((g) => g.cells));
    const missing = value.map((v, m) => (v === target && !covered.has(m) ? m : null)).filter((m) => m !== null);
    if (missing.length) throw new KmapError(`還有 ${target} 沒圈到：${missing.join(', ')}（若是分步驟講解，請加上 partial: true）`);
  }

  if (spec.caption !== undefined && typeof spec.caption !== 'string') throw new KmapError('caption 必須是字串');

  return { vars, n, mode, value, groups, partial, caption: spec.caption ?? '' };
}

/** 一組格子若形成合法的圈，回傳 {mask, bits}（mask 為變動的位元），否則回傳 null。 */
function toCube(cells, n) {
  const k = Math.log2(cells.length);
  if (!Number.isInteger(k)) return null;
  const and = cells.reduce((a, m) => a & m, (1 << n) - 1);
  const or = cells.reduce((a, m) => a | m, 0);
  const free = and ^ or;
  if (popcount(free) !== k) return null;
  return { free, fixed: and };
}

function popcount(x) {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}

/** 把圈轉成 LaTeX 項：sop → 乘積項，pos → 和項。補數用 \inv{}。 */
function cubeToTerm(cube, vars, mode) {
  const n = vars.length;
  const lits = [];
  for (let i = 0; i < n; i++) {
    const bit = 1 << (n - 1 - i);
    if (cube.free & bit) continue;
    const isOne = (cube.fixed & bit) !== 0;
    const positive = mode === 'sop' ? isOne : !isOne;
    lits.push(positive ? vars[i] : `\\inv{${vars[i]}}`);
  }
  if (lits.length === 0) return mode === 'sop' ? '1' : '0';
  if (mode === 'pos') return lits.length === 1 ? lits[0] : `(${lits.join(' + ')})`;
  // 相鄰兩個補數之間加細空白，避免兩條橫線連成一條（\inv{B}\inv{D} 看起來會像 \inv{BD}）
  return lits.reduce((acc, lit, i) => acc + (i > 0 && lit.startsWith('\\inv') && lits[i - 1].startsWith('\\inv') ? '\\,' : '') + lit, '');
}

/** 由變數數量決定列、欄的變數與格雷碼順序。 */
function layout(n) {
  const rowBits = Math.floor(n / 2);
  const colBits = n - rowBits;
  return { rowBits, colBits, rows: GRAY[rowBits], cols: GRAY[colBits] };
}

const bin = (v, width) => v.toString(2).padStart(width, '0');

/**
 * 產生 kmap HTML。
 * @param {object} km parseKmap 的結果
 * @param {(tex: string) => string} renderMath 行內數學式渲染函式
 * @param {(md: string) => string} renderInline 行內 Markdown 渲染函式（caption 用）
 */
export function renderKmap(km, renderMath, renderInline) {
  const { vars, n, mode, value, groups } = km;
  const { rowBits, colBits, rows, cols } = layout(n);
  const R = rows.length;
  const C = cols.length;
  const minterm = (r, c) => (rows[r] << colBits) | cols[c];

  const groupOf = groups.map((g) => new Set(g.cells));
  const inGroup = (gi, r, c) => groupOf[gi].has(minterm(r, c));
  // 一圈是否「跨邊界」：同時佔用第一列與最後一列，但沒有佔滿整個方向
  const wraps = groups.map((_, gi) => {
    const rs = new Set();
    const cs = new Set();
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (groupOf[gi].has(minterm(r, c))) {
      rs.add(r);
      cs.add(c);
    }
    return {
      rows: R > 2 && rs.has(0) && rs.has(R - 1) && rs.size < R,
      cols: C > 2 && cs.has(0) && cs.has(C - 1) && cs.size < C,
    };
  });

  const rowVars = vars.slice(0, rowBits).join('');
  const colVars = vars.slice(rowBits).join('');

  let cells = '';
  cells += `<div class="km-corner" aria-hidden="true"><span class="km-cv">${colVars}</span><span class="km-rv">${rowVars}</span></div>`;
  for (let c = 0; c < C; c++) cells += `<div class="km-head km-col">${bin(cols[c], colBits)}</div>`;

  for (let r = 0; r < R; r++) {
    cells += `<div class="km-head km-row">${bin(rows[r], rowBits)}</div>`;
    for (let c = 0; c < C; c++) {
      const m = minterm(r, c);
      const v = value[m];
      const shown = v === 'x' ? '×' : String(v);
      const cls = (v === 'x' ? 'is-x' : v === 1 ? 'is-1' : 'is-0') + (r === 0 ? ' r0' : '') + (c === 0 ? ' c0' : '');
      let marks = '';
      groups.forEach((g, gi) => {
        if (!groupOf[gi].has(m)) return;
        // 與同圈相鄰的邊（含跨邊界）不畫線，形成連續的圈；邊界外的延續讓那一側保持開口
        const w = wraps[gi];
        const open = {
          t: r > 0 ? inGroup(gi, r - 1, c) : w.rows && inGroup(gi, R - 1, c),
          b: r < R - 1 ? inGroup(gi, r + 1, c) : w.rows && inGroup(gi, 0, c),
          l: c > 0 ? inGroup(gi, r, c - 1) : w.cols && inGroup(gi, r, C - 1),
          rt: c < C - 1 ? inGroup(gi, r, c + 1) : w.cols && inGroup(gi, r, 0),
        };
        const inset = 4 + gi * 4;
        const style = [
          `top:${open.t ? 0 : inset}px`,
          `bottom:${open.b ? 0 : inset}px`,
          `left:${open.l ? 0 : inset}px`,
          `right:${open.rt ? 0 : inset}px`,
          `border-top-width:${open.t ? 0 : 2}px`,
          `border-bottom-width:${open.b ? 0 : 2}px`,
          `border-left-width:${open.l ? 0 : 2}px`,
          `border-right-width:${open.rt ? 0 : 2}px`,
        ].join(';');
        marks += `<span class="km-loop g${gi + 1}" style="${style}"></span>`;
      });
      cells += `<div class="km-cell ${cls}" title="m${m}">${marks}<span class="km-idx">${m}</span><span class="km-val">${shown}</span></div>`;
    }
  }

  const op = mode === 'sop' ? ' + ' : ' ';
  let legend = '';
  if (groups.length) {
    const items = groups
      .map((g, gi) => `<li><span class="km-swatch g${gi + 1}"></span>${renderMath(g.term)}<span class="km-cells">(${g.cells.join(', ')})</span></li>`)
      .join('');
    const fName = `F(${vars.join(',')})`;
    const result = km.partial ? '' : `<p class="km-result">${renderMath(`${fName} = ${groups.map((g) => g.term).join(op)}`)}</p>`;
    legend = `<ul class="km-legend">${items}</ul>${result}`;
  }

  const caption = km.caption ? `<figcaption>${renderInline(km.caption)}</figcaption>` : '';
  const label = `${n} 變數卡諾圖（${mode === 'sop' ? '圈 1' : '圈 0'}）`;
  return `<figure class="kmap" aria-label="${label}"><div class="km-grid" style="--cols:${C}">${cells}</div>${legend}${caption}</figure>\n`;
}
