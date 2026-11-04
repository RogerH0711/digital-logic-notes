// Markdown 設定：所有內容元件都在這裡註冊。
// 新增元件的流程見 AGENTS.md 第 11 節。

import MarkdownIt from 'markdown-it';
import container from 'markdown-it-container';
import anchor from 'markdown-it-anchor';
import mdKatex from '@vscode/markdown-it-katex';
import katex from 'katex';
import { parseKmap, renderKmap, KmapError } from './kmap.mjs';

/** 全站共用的 KaTeX 巨集；補數一律寫 \inv{X}。 */
export const KATEX_MACROS = {
  '\\inv': '\\overline{#1}',
};

export const CALLOUTS = {
  definition: '定義',
  note: '補充',
  tip: '技巧',
  warning: '常見錯誤',
  example: '例題',
};

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 中文標題也能產生穩定的 id：保留中日韓文字、英數，其餘換成連字號。 */
export function slugify(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{Script=Han}\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function renderMath(tex, displayMode = false) {
  return katex.renderToString(tex, { macros: { ...KATEX_MACROS }, displayMode, throwOnError: true, output: 'htmlAndMathml' });
}

/**
 * 建立 markdown-it 實例。
 * 渲染時傳入 env = { errors: [], headings: [], exercises: 0, lineOffset }，
 * 元件會把錯誤、標題、練習題數量寫回 env，供驗證使用。
 */
export function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

  md.use(mdKatex.default ?? mdKatex, { katex, macros: { ...KATEX_MACROS }, throwOnError: false });

  md.use(anchor, {
    slugify,
    level: [2, 3],
    tabIndex: false,
    permalink: anchor.permalink.linkInsideHeader({ symbol: '#', placement: 'after', ariaHidden: true, class: 'h-anchor' }),
  });

  // 提示框：::: definition 標題
  for (const [name, label] of Object.entries(CALLOUTS)) {
    md.use(container, name, {
      render(tokens, idx) {
        const t = tokens[idx];
        if (t.nesting === 1) {
          const title = t.info.trim().slice(name.length).trim();
          const heading = title ? `<span class="co-kind">${label}</span>${md.renderInline(title)}` : `<span class="co-kind">${label}</span>`;
          return `<aside class="callout co-${name}"><p class="co-title">${heading}</p>\n`;
        }
        return '</aside>\n';
      },
    });
  }

  // 練習題：:::: exercise 標題，內含 ::: answer
  md.use(container, 'exercise', {
    render(tokens, idx, _opts, env) {
      const t = tokens[idx];
      if (t.nesting === 1) {
        env.exercises = (env.exercises ?? 0) + 1;
        const n = env.exercises;
        // 找到對應的結束 token，確認裡面有 answer
        let depth = 0;
        let hasAnswer = false;
        for (let j = idx; j < tokens.length; j++) {
          if (tokens[j].type === 'container_exercise_open') depth++;
          if (tokens[j].type === 'container_exercise_close' && --depth === 0) break;
          if (tokens[j].type === 'container_answer_open') hasAnswer = true;
        }
        if (!hasAnswer) env.errors?.push({ line: line(env, t), message: `練習 ${n} 沒有 ::: answer 解答` });
        const title = t.info.trim().slice('exercise'.length).trim();
        if (/^第\s*\d+\s*題/.test(title)) env.errors?.push({ line: line(env, t), message: '練習題標題不要自己寫題號，題號會自動產生' });
        return `<section class="exercise" id="ex-${n}"><p class="ex-title"><span class="ex-no">練習 ${n}</span>${title ? md.renderInline(title) : ''}</p>\n`;
      }
      return '</section>\n';
    },
  });

  md.use(container, 'answer', {
    render(tokens, idx) {
      return tokens[idx].nesting === 1 ? '<details class="answer"><summary>看解答</summary><div class="answer-body">\n' : '</div></details>\n';
    },
  });

  // 不認得的 ::: 區塊
  md.core.ruler.after('block', 'unknown_container', (state) => {
    for (const t of state.tokens) {
      if (t.type === 'paragraph_open') continue;
      if (t.type === 'inline' && /^:{3,}\s*\w/.test(t.content)) {
        state.env.errors?.push({ line: line(state.env, t), message: `不認得的區塊「${t.content.split('\n')[0]}」，可用：${[...Object.keys(CALLOUTS), 'exercise', 'answer'].join(', ')}` });
      }
    }
  });

  // ```kmap 區塊
  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const t = tokens[idx];
    const lang = t.info.trim().split(/\s+/)[0];
    if (lang === 'kmap') {
      try {
        const km = parseKmap(t.content);
        return renderKmap(km, (tex) => renderMath(tex), (s) => md.renderInline(s));
      } catch (e) {
        if (!(e instanceof KmapError) && !(e instanceof katex.ParseError)) throw e;
        env.errors?.push({ line: line(env, t), message: `kmap：${e.message}` });
        return `<pre class="build-error">${escapeHtml(e.message)}</pre>`;
      }
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  // 原始 HTML 會被當成文字；在驗證階段提醒
  md.core.ruler.push('no_raw_html', (state) => {
    for (const t of state.tokens) {
      if (t.type !== 'inline') continue;
      if (/<\/?(div|span|br|p|img|table|details|summary|font|b|i|u|sup|sub)\b[^>]*>/i.test(t.content)) {
        state.env.errors?.push({ line: line(state.env, t), message: '不要在 Markdown 裡寫原始 HTML，請改用 AGENTS.md 第 7 節的元件語法' });
      }
    }
  });

  // 數學式錯誤
  md.core.ruler.push('math_errors', (state) => {
    for (const t of state.tokens) {
      const check = (tok) => {
        if (tok.type !== 'math_inline' && tok.type !== 'math_block' && tok.type !== 'math_inline_block') return;
        try {
          renderMath(tok.content, tok.type !== 'math_inline');
        } catch (e) {
          state.env.errors?.push({ line: line(state.env, t), message: `數學式錯誤：${e.message}` });
        }
      };
      check(t);
      t.children?.forEach(check);
    }
  });

  // 收集圖片（驗證路徑與替代文字）
  md.core.ruler.push('collect_images', (state) => {
    for (const t of state.tokens) {
      for (const c of t.children ?? []) {
        if (c.type !== 'image') continue;
        const alt = c.children?.map((x) => x.content).join('').trim() ?? '';
        state.env.images?.push({ src: c.attrGet('src'), alt, line: line(state.env, t) });
      }
    }
  });

  // 收集標題（驗證章節順序、產生本頁目錄）
  md.core.ruler.push('collect_headings', (state) => {
    const toks = state.tokens;
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].type !== 'heading_open') continue;
      const level = Number(toks[i].tag.slice(1));
      const inline = toks[i + 1];
      const text = inline.children.filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('').trim();
      state.env.headings?.push({ level, text, id: toks[i].attrGet('id'), line: line(state.env, toks[i]) });
    }
  });

  return md;
}

function line(env, token) {
  return (token.map?.[0] ?? 0) + 1 + (env.lineOffset ?? 0);
}
