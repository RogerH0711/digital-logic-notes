// 內容驗證規則：對應 AGENTS.md 第 5 節。改規則時要同步更新 AGENTS.md。

const ID_RE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_FIELDS = ['title', 'unit', 'summary', 'tags', 'prerequisites', 'updated'];
const SUMMARY_MAX = 60;
const MIN_EXERCISES = 2;

/** 驗證 syllabus.yml，回傳錯誤陣列。 */
export function validateSyllabus(syllabus) {
  const errors = [];
  const push = (message) => errors.push({ file: 'content/syllabus.yml', line: 0, message });
  if (!Array.isArray(syllabus?.units) || syllabus.units.length === 0) {
    push('units 必須是非空陣列');
    return errors;
  }
  if (!Array.isArray(syllabus.tags) || syllabus.tags.length === 0) push('tags 必須是非空陣列');
  const seen = new Set();
  syllabus.units.forEach((u, i) => {
    if (!u || typeof u.id !== 'string' || !ID_RE.test(u.id)) return push(`第 ${i + 1} 個單元的 id「${u?.id}」格式錯誤，應為 NN-kebab-case`);
    if (typeof u.title !== 'string' || !u.title.trim()) push(`${u.id} 缺少 title`);
    if (typeof u.chapter !== 'string' || !u.chapter.trim()) push(`${u.id} 缺少 chapter（對應課本章節）`);
    if (seen.has(u.id)) push(`id ${u.id} 重複`);
    seen.add(u.id);
    const n = Number(u.id.slice(0, 2));
    if (n !== i + 1) push(`${u.id} 的編號應為 ${String(i + 1).padStart(2, '0')}（單元必須依序從 01 連續編號）`);
  });
  return errors;
}

/** 驗證單一單元：frontmatter 與 render 時收集到的資訊。 */
export function validateUnit({ id, file, data, env, syllabus, fmLine }) {
  const errors = [];
  const push = (message, line = fmLine) => errors.push({ file, line, message });

  if (!ID_RE.test(id)) push(`檔名「${id}.md」格式錯誤，應為 NN-kebab-case.md`, 1);
  const entry = syllabus.units.find((u) => u.id === id);
  if (!entry) push(`content/syllabus.yml 裡沒有 id 為 ${id} 的單元，請先新增大綱條目`, 1);

  for (const key of REQUIRED_FIELDS) if (data[key] === undefined || data[key] === null) push(`frontmatter 缺少 ${key}`);
  const extra = Object.keys(data).filter((k) => !REQUIRED_FIELDS.includes(k));
  if (extra.length) push(`frontmatter 有未定義的欄位：${extra.join(', ')}`);

  if (entry && data.title !== entry.title) push(`title「${data.title}」必須和 syllabus.yml 的「${entry.title}」相同`);
  if (data.unit !== undefined && data.unit !== Number(id.slice(0, 2))) push(`unit 應為 ${Number(id.slice(0, 2))}（等於檔名前兩碼）`);

  if (typeof data.summary !== 'string' || !data.summary.trim()) push('summary 必須是一句話');
  else if ([...data.summary].length > SUMMARY_MAX) push(`summary 有 ${[...data.summary].length} 字，上限 ${SUMMARY_MAX} 字`);

  if (!Array.isArray(data.tags) || data.tags.length < 1 || data.tags.length > 4) push('tags 必須是 1–4 個詞的陣列');
  else for (const t of data.tags) if (!syllabus.tags.includes(t)) push(`tag「${t}」不在 syllabus.yml 的 tags 清單內`);

  if (!Array.isArray(data.prerequisites)) push('prerequisites 必須是陣列，沒有就寫 []');
  else
    for (const p of data.prerequisites) {
      if (!syllabus.units.some((u) => u.id === p)) push(`prerequisites 的「${p}」不是 syllabus.yml 裡的單元 id`);
      else if (Number(p.slice(0, 2)) >= Number(id.slice(0, 2))) push(`prerequisites 只能指向編號更小的單元，「${p}」不行`);
    }

  const updated = data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : data.updated;
  if (typeof updated !== 'string' || !DATE_RE.test(updated)) push('updated 格式應為 YYYY-MM-DD');

  // 章節骨架
  const headings = env.headings;
  const h1 = headings.find((h) => h.level === 1);
  if (h1) push('內文不要寫 H1（#），標題由 frontmatter 產生', h1.line);
  const h2 = headings.filter((h) => h.level === 2);
  const names = h2.map((h) => h.text);
  if (names[0] !== '學習目標') push('第一個 H2 必須是「## 學習目標」', h2[0]?.line ?? fmLine);
  if (names.at(-1) !== '練習題') push('最後一個 H2 必須是「## 練習題」', h2.at(-1)?.line ?? fmLine);
  if (names.at(-2) !== '重點整理') push('倒數第二個 H2 必須是「## 重點整理」', h2.at(-2)?.line ?? fmLine);
  if (h2.length < 4) push('除了學習目標、重點整理、練習題之外，至少要有一個正文 H2');
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) push(`標題跳級：H${headings[i - 1].level} 後面直接接 H${headings[i].level}`, headings[i].line);
  }

  if ((env.exercises ?? 0) < MIN_EXERCISES) push(`至少要有 ${MIN_EXERCISES} 題練習（目前 ${env.exercises ?? 0} 題）`);
  for (const e of env.errors) errors.push({ file, line: e.line, message: e.message });

  return { errors, updated };
}
