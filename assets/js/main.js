// 全站互動：深淺色切換、本頁目錄高亮、手機版收合單元目錄。
// 內容頁不依賴這支程式也能正常閱讀。

(() => {
  const root = document.documentElement;

  // 深淺色切換
  const toggle = document.querySelector('.theme-toggle');
  toggle?.addEventListener('click', () => {
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      /* 無法儲存時只影響本次瀏覽 */
    }
  });

  // 手機版預設收合單元目錄
  const nav = document.querySelector('.unit-nav-box');
  if (nav && matchMedia('(max-width: 860px)').matches) nav.open = false;

  // 本頁目錄：捲動時高亮目前段落
  const links = [...document.querySelectorAll('.page-toc a')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const headings = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const visible = new Set();
  const update = () => {
    const first = headings.find((h) => visible.has(h)) ?? headings.filter((h) => h.getBoundingClientRect().top < 100).pop();
    links.forEach((a) => a.classList.toggle('active', first && byId.get(first.id) === a));
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
      update();
    },
    { rootMargin: '-72px 0px -60% 0px' },
  );
  headings.forEach((h) => io.observe(h));
})();
