// 樣板工具：{{key}} 置換。值不會自動跳脫，呼叫端負責 escapeHtml。

export function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`樣板變數 {{${key}}} 沒有提供`);
    return vars[key];
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** 單元編號轉 4-bit 二進位徽章，例如 2 → 0010。 */
export function toBits(n) {
  return n.toString(2).padStart(4, '0');
}
