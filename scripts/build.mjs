#!/usr/bin/env node
// 進入點：讀內容 → 驗證 → 輸出 dist/。
//   node scripts/build.mjs          驗證＋產生網站
//   node scripts/build.mjs --check  只驗證

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { load as parseYaml } from 'js-yaml';
import { createMarkdown } from './lib/markdown.mjs';
import { validateSyllabus, validateUnit } from './lib/validate.mjs';
import { fill, escapeHtml, toBits } from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const UNITS_DIR = path.join(ROOT, 'content', 'units');
const CHECK_ONLY = process.argv.includes('--check');
const require = createRequire(import.meta.url);

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------- 讀取設定與大綱 ----------
const config = JSON.parse(read('site.config.json'));
const syllabus = parseYaml(read('content/syllabus.yml'));
const errors = validateSyllabus(syllabus);

// ---------- 讀取並渲染單元 ----------
const md = createMarkdown();
const units = [];

const files = fs
  .readdirSync(UNITS_DIR)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .sort();

for (const f of files) {
  const file = rel(path.join(UNITS_DIR, f));
  const id = f.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(UNITS_DIR, f), 'utf8').replace(/\r\n/g, '\n');

  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    errors.push({ file, line: 1, message: '檔案開頭缺少 --- 包住的 frontmatter' });
    continue;
  }
  let data;
  try {
    data = parseYaml(m[1]) ?? {};
  } catch (e) {
    errors.push({ file, line: (e.mark?.line ?? 0) + 2, message: `frontmatter YAML 錯誤：${e.reason ?? e.message}` });
    continue;
  }
  const body = raw.slice(m[0].length);
  const lineOffset = m[0].split('\n').length - 1;
  const env = { errors: [], headings: [], images: [], exercises: 0, lineOffset };
  const html = md.render(body, env);

  for (const img of env.images) {
    if (!img.alt) env.errors.push({ line: img.line, message: `圖片 ${img.src} 缺少替代文字` });
    if (/^https?:/.test(img.src)) continue;
    const expected = `../assets/img/${id}/`;
    if (!img.src.startsWith(expected)) env.errors.push({ line: img.line, message: `圖片路徑應以 ${expected} 開頭` });
    else if (!fs.existsSync(path.join(ROOT, img.src.slice(3)))) env.errors.push({ line: img.line, message: `找不到圖片 ${img.src.slice(3)}` });
  }

  const { errors: unitErrors, updated } = validateUnit({ id, file, data, env, syllabus, fmLine: 2 });
  errors.push(...unitErrors);
  units.push({ id, file, data: { ...data, updated }, html, headings: env.headings, exercises: env.exercises });
}

// ---------- 回報 ----------
if (errors.length) {
  console.error(`\n✗ 發現 ${errors.length} 個問題：\n`);
  for (const e of errors) console.error(`  ${e.file}${e.line ? `:${e.line}` : ''}  ${e.message}`);
  console.error('\n修正後重新執行 npm run check。規則見 AGENTS.md。\n');
  process.exit(1);
}

const planned = syllabus.units.filter((u) => !units.some((x) => x.id === u.id));
console.log(`✓ 內容驗證通過：${units.length} 個單元、${units.reduce((a, u) => a + u.exercises, 0)} 題練習；大綱中尚有 ${planned.length} 個單元撰寫中。`);
if (CHECK_ONLY) process.exit(0);

// ---------- 輸出網站 ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'units'), { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });

const katexDist = path.join(path.dirname(require.resolve('katex/package.json')), 'dist');
fs.mkdirSync(path.join(DIST, 'assets', 'katex'), { recursive: true });
fs.copyFileSync(path.join(katexDist, 'katex.min.css'), path.join(DIST, 'assets', 'katex', 'katex.min.css'));
fs.cpSync(path.join(katexDist, 'fonts'), path.join(DIST, 'assets', 'katex', 'fonts'), { recursive: true });

const layout = read('templates/layout.html');
const unitTpl = read('templates/unit.html');
const indexTpl = read('templates/index.html');
const byId = Object.fromEntries(units.map((u) => [u.id, u]));
const published = syllabus.units.filter((u) => byId[u.id]);

const page = (vars) =>
  fill(layout, {
    lang: config.lang,
    siteTitle: escapeHtml(config.title),
    siteSubtitle: escapeHtml(config.subtitle),
    author: escapeHtml(config.author),
    repo: config.repo,
    branch: config.branch,
    editLink: '',
    ...vars,
  });

// 單元頁
for (const u of units) {
  const root = '../';
  const no = Number(u.id.slice(0, 2));
  const sidebar = syllabus.units
    .map((s) => {
      const n = s.id.slice(0, 2);
      const label = `<span class="bits">${toBits(Number(n))}</span><span>${escapeHtml(s.title)}</span>`;
      if (s.id === u.id) return `          <li class="current"><a href="${s.id}.html" aria-current="page">${label}</a></li>`;
      if (byId[s.id]) return `          <li><a href="${s.id}.html">${label}</a></li>`;
      return `          <li class="planned"><span>${label}<em>撰寫中</em></span></li>`;
    })
    .join('\n');

  const prereq = u.data.prerequisites.length
    ? u.data.prerequisites
        .map((p) => {
          const s = syllabus.units.find((x) => x.id === p);
          return byId[p] ? `<a href="${p}.html">${escapeHtml(s.title)}</a>` : `<span class="muted">${escapeHtml(s.title)}（撰寫中）</span>`;
        })
        .join('、')
    : '無';
  const meta = [
    `          <div><dt>先備單元</dt><dd>${prereq}</dd></div>`,
    `          <div><dt>標籤</dt><dd>${u.data.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</dd></div>`,
    `          <div><dt>更新</dt><dd><time datetime="${u.data.updated}">${u.data.updated}</time></dd></div>`,
  ].join('\n');

  const toc = u.headings
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => `        <li class="toc-h${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join('\n');

  const idx = published.findIndex((s) => s.id === u.id);
  const prev = published[idx - 1];
  const next = published[idx + 1];
  const pager = [
    prev ? `        <a class="prev" href="${prev.id}.html"><span>上一單元</span>${escapeHtml(prev.title)}</a>` : '        <span></span>',
    next ? `        <a class="next" href="${next.id}.html"><span>下一單元</span>${escapeHtml(next.title)}</a>` : '        <span></span>',
  ].join('\n');

  const body = fill(unitTpl, {
    sidebar,
    unitBits: toBits(no),
    unitNo: String(no).padStart(2, '0'),
    chapter: escapeHtml(syllabus.units.find((x) => x.id === u.id).chapter),
    title: escapeHtml(u.data.title),
    summary: escapeHtml(u.data.summary),
    meta,
    content: u.html,
    pager,
    toc,
  });

  const html = page({
    root,
    pageTitle: `${escapeHtml(u.data.title)}｜${escapeHtml(config.title)}`,
    description: escapeHtml(u.data.summary),
    bodyClass: 'page-unit',
    editLink: ` · <a href="${config.repo}/edit/${config.branch}/${u.file}">編輯這一頁</a>`,
    body,
  });
  fs.writeFileSync(path.join(DIST, 'units', `${u.id}.html`), html);
}

// 首頁
const cards = syllabus.units
  .map((s) => {
    const n = Number(s.id.slice(0, 2));
    const u = byId[s.id];
    const head = `<span class="bits">${toBits(n)}</span><span class="card-no">${escapeHtml(s.chapter)}</span>`;
    if (!u) return `        <li class="unit-card planned"><div class="card-head">${head}<em>撰寫中</em></div><h3>${escapeHtml(s.title)}</h3></li>`;
    const tags = u.data.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    return `        <li class="unit-card"><a href="units/${s.id}.html"><div class="card-head">${head}<span class="card-ex">${u.exercises} 題練習</span></div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(u.data.summary)}</p><div class="card-tags">${tags}</div></a></li>`;
  })
  .join('\n');

fs.writeFileSync(
  path.join(DIST, 'index.html'),
  page({
    root: '',
    pageTitle: `${escapeHtml(config.title)}｜${escapeHtml(config.subtitle)}`,
    description: escapeHtml(config.tagline),
    bodyClass: 'page-home',
    body: fill(indexTpl, {
      siteTitle: escapeHtml(config.title),
      siteSubtitle: escapeHtml(config.subtitle),
      tagline: escapeHtml(config.tagline),
      publishedCount: String(units.length),
      plannedCount: String(planned.length),
      exerciseCount: String(units.reduce((a, u) => a + u.exercises, 0)),
      cards,
    }),
  }),
);

fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`✓ 網站已輸出到 dist/（首頁＋${units.length} 個單元頁）`);
