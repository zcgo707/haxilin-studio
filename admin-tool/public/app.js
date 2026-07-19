/* ================================================================
   HaxiLin Studio — 博客编辑器交互逻辑
   ================================================================ */

/* ==================== Markdown 解析器 ==================== */
function parseMarkdown(text) {
  if (!text) return '<p style="color:var(--text-tertiary)">预览区为空</p>';
  const lines = text.split("\n");
  const out = [];
  let inCode = false, inUl = false, inOl = false, inBq = false;
  let para = [];

  function flushPara() {
    if (para.length) { out.push("<p>" + para.join(" ") + "</p>"); para = []; }
  }
  function closeUl() { if (inUl) { out.push("</ul>"); inUl = false; } }
  function closeOl() { if (inOl) { out.push("</ol>"); inOl = false; } }
  function closeBq() { if (inBq) { out.push("</blockquote>"); inBq = false; } }
  function closeAll() { closeUl(); closeOl(); closeBq(); flushPara(); }

  function inline(t) {
    t = t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // 编辑器预览：将相对路径 ../assets/ 改为 /assets/，使图片在预览中正常加载
    t = t.replace(/src="\.\.\/assets\//g, 'src="/assets/');
    t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
      const fixedUrl = url.replace(/^\.\.\/assets\//, "/assets/");
      return `<img src="${fixedUrl}" alt="${alt}">`;
    });
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/`(.+?)`/g, "<code>$1</code>");
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
    return t;
  }

  for (const line of lines) {
    // 代码块
    if (line.startsWith("```")) {
      if (inCode) { out.push("</code></pre>"); inCode = false; }
      else { closeAll(); out.push("<pre><code>"); inCode = true; }
      continue;
    }
    if (inCode) { out.push(line.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")); continue; }
    if (line.trim() === "") { closeAll(); continue; }

    // 标题
    let m;
    if (m = line.match(/^### (.+)/)) { closeAll(); out.push("<h3>" + inline(m[1]) + "</h3>"); continue; }
    if (m = line.match(/^## (.+)/)) { closeAll(); out.push("<h2>" + inline(m[1]) + "</h2>"); continue; }
    if (m = line.match(/^# (.+)/)) { closeAll(); out.push("<h1>" + inline(m[1]) + "</h1>"); continue; }
    if (line.match(/^---+$/)) { closeAll(); out.push("<hr>"); continue; }

    // 引用
    if (m = line.match(/^> (.+)/)) { closeUl(); closeOl(); flushPara(); if (!inBq) { out.push("<blockquote>"); inBq = true; } out.push(inline(m[1])); continue; }

    // 无序列表
    if (m = line.match(/^[-*] (.+)/)) { closeOl(); closeBq(); flushPara(); if (!inUl) { out.push("<ul>"); inUl = true; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }

    // 有序列表
    if (m = line.match(/^\d+\. (.+)/)) { closeUl(); closeBq(); flushPara(); if (!inOl) { out.push("<ol>"); inOl = true; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }

    // 普通段落
    closeUl(); closeOl(); closeBq();
    para.push(inline(line));
  }

  closeAll();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

/* ==================== 状态 ==================== */
const state = {
  view: "split",
  currentFile: null,
  isDraft: false,
  articles: [],
  filter: "all",
  search: "",
  selectedTags: [],
  allTags: [],
  sidebarCollapsed: false,
  hasChanges: false,
  autoSaveKey: "haxilin-editor-autosave",
};

/* ==================== DOM 辅助 ==================== */
const $ = (id) => document.getElementById(id);

function showToast(msg, type = "info") {
  const container = $("toastContainer") || (() => {
    const c = document.createElement("div");
    c.id = "toastContainer";
    c.className = "toast-container";
    document.body.appendChild(c);
    return c;
  })();
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.classList.add("removing"); setTimeout(() => t.remove(), 250); }, 2800);
}

function escHtml(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

/* ==================== API ==================== */
async function apiGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function apiPost(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function apiDelete(url) {
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ==================== 日期 ==================== */
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-"); }
  catch { return d; }
}

/* ==================== 字数统计 ==================== */
function countWords(text) {
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (text.replace(/[\u4e00-\u9fff]/g, " ").match(/[a-zA-Z0-9]+/g) || []).length;
  return cn + en;
}

function readTime(text) {
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (text.replace(/[\u4e00-\u9fff]/g, " ").match(/[a-zA-Z0-9]+/g) || []).length;
  const min = Math.ceil(cn / 300 + en / 200);
  return Math.max(1, min);
}

/* ==================== 文章列表 ==================== */
async function loadArticles() {
  try {
    const [draftsRes, postsRes] = await Promise.all([
      apiGet("/api/drafts"),
      apiGet("/api/list"),
    ]);
    const drafts = (draftsRes.drafts || []).map(d => ({ ...d, _type: "draft" }));
    const posts = (postsRes.posts || []).map(p => ({ ...p, _type: "published" }));
    state.articles = [...drafts, ...posts].sort((a, b) => {
      const da = new Date(a.modified || a.pubDate || 0).valueOf();
      const db = new Date(b.modified || b.pubDate || 0).valueOf();
      return db - da;
    });

    // 收集所有标签
    state.allTags = [...new Set(posts.flatMap(p => p.tags || []))].sort();

    renderArticleList();
  } catch (e) {
    showToast("加载文章列表失败: " + e.message, "error");
  }
}

function renderArticleList() {
  const el = $("articleList");
  let items = state.articles;

  // 筛选
  if (state.filter !== "all") {
    items = items.filter(a => a._type === state.filter);
  }

  // 搜索
  if (state.search) {
    const q = state.search.toLowerCase();
    items = items.filter(a =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (items.length === 0) {
    el.innerHTML = '<div class="empty-list">暂无文章</div>';
    return;
  }

  el.innerHTML = items.map(a => {
    const isActive = state.currentFile === a.filename;
    const badge = a._type === "draft"
      ? '<span class="ai-badge draft">草稿</span>'
      : '<span class="ai-badge published">已发布</span>';
    const tags = (a.tags || []).slice(0, 2).map(t => `#${t}`).join(" ");
    const date = fmtDate(a.pubDate) || fmtDate(a.modified);
    return `<div class="article-item ${isActive ? "active" : ""}" onclick="loadArticle('${escHtml(a.filename)}', ${a._type === "draft"})">
      <div class="ai-title">${escHtml(a.title || a.filename)}</div>
      <div class="ai-meta">${badge} ${date}${tags ? " · " + tags : ""}</div>
    </div>`;
  }).join("");
}

/* ==================== 加载文章 ==================== */
async function loadArticle(filename, isDraft) {
  try {
    const base = isDraft ? "/api/draft" : "/api/get";
    const data = await apiGet(`${base}?file=${encodeURIComponent(filename)}`);
    if (!data.success) { showToast(data.error || "加载失败", "error"); return; }

    const fm = data.frontmatter || data;
    $("fTitle").value = fm.title || "";
    $("fDesc").value = fm.description || "";
    $("fAuthor").value = fm.author || "HaxiLin";
    $("fDate").value = fm.pubDate || todayStr();
    $("fContent").value = data.content || "";

    state.selectedTags = fm.tags || [];
    state.currentFile = filename;
    state.isDraft = isDraft;
    state.hasChanges = false;

    renderTags();
    updatePreview();
    updateWordCount();
    updateBreadcrumb();
    showEditor();

    // 显示删除按钮
    $("btnDelete").style.display = isDraft ? "" : "none";
  } catch (e) {
    showToast("加载失败: " + e.message, "error");
  }
}

/* ==================== 新建文章 ==================== */
function newArticle() {
  $("fTitle").value = "";
  $("fDesc").value = "";
  $("fAuthor").value = "HaxiLin";
  $("fDate").value = todayStr();
  $("fContent").value = "";

  state.currentFile = null;
  state.isDraft = false;
  state.selectedTags = [];
  state.hasChanges = false;

  renderTags();
  updatePreview();
  updateWordCount();
  updateBreadcrumb();
  showEditor();

  $("btnDelete").style.display = "none";
  $("fTitle").focus();
}

/* ==================== 保存草稿 ==================== */
async function saveDraft() {
  const title = $("fTitle").value.trim();
  const desc = $("fDesc").value.trim();
  const content = $("fContent").value.trim();
  if (!title) { showToast("请输入标题", "error"); return; }
  if (!content) { showToast("请输入正文", "error"); return; }

  const btn = $("btnDraft");
  btn.disabled = true;
  try {
    const data = await apiPost("/api/draft", {
      title, description: desc || "无简介", author: $("fAuthor").value.trim() || "HaxiLin",
      pubDate: $("fDate").value || todayStr(), tags: state.selectedTags.length ? state.selectedTags : ["未分类"],
      content, filename: state.currentFile,
    });
    if (data.success) {
      state.currentFile = data.filename;
      state.isDraft = true;
      state.hasChanges = false;
      $("btnDelete").style.display = "";
      updateBreadcrumb();
      updateSaveStatus("saved");
      showToast("草稿已保存", "success");
      await loadArticles();
    } else { showToast(data.error || "保存失败", "error"); }
  } catch (e) { showToast("保存失败: " + e.message, "error"); }
  btn.disabled = false;
}

/* ==================== 发布文章 ==================== */
async function publish() {
  const title = $("fTitle").value.trim();
  const desc = $("fDesc").value.trim();
  const content = $("fContent").value.trim();
  if (!title) { showToast("请输入标题", "error"); return; }
  if (!content) { showToast("请输入正文", "error"); return; }
  if (state.selectedTags.length === 0) { showToast("请至少添加一个标签", "error"); return; }

  const btn = $("btnPublish");
  btn.disabled = true;
  try {
    const data = await apiPost("/api/save", {
      title, description: desc || "无简介", author: $("fAuthor").value.trim() || "HaxiLin",
      pubDate: $("fDate").value || todayStr(), tags: state.selectedTags,
      content, filename: state.currentFile && !state.isDraft ? state.currentFile : null,
    });
    if (data.success) {
      // 如果原来是草稿，删除草稿文件
      if (state.isDraft && state.currentFile) {
        try { await apiDelete(`/api/draft?file=${encodeURIComponent(state.currentFile)}`); } catch {}
      }
      state.currentFile = data.filename;
      state.isDraft = false;
      state.hasChanges = false;
      $("btnDelete").style.display = "none";
      updateBreadcrumb();
      updateSaveStatus("saved");
      showToast("文章已发布", "success");
      await loadArticles();
    } else { showToast(data.error || "发布失败", "error"); }
  } catch (e) { showToast("发布失败: " + e.message, "error"); }
  btn.disabled = false;
}

/* ==================== 删除文章 ==================== */
async function deleteArticle() {
  if (!state.currentFile) return;
  const isDraft = state.isDraft;
  const msg = isDraft
    ? `确定删除草稿「${state.currentFile}」？`
    : `确定删除已发布文章「${state.currentFile}」？此操作不可撤销。`;
  if (!confirm(msg)) return;

  try {
    if (isDraft) {
      await apiDelete(`/api/draft?file=${encodeURIComponent(state.currentFile)}`);
    } else {
      await apiDelete(`/api/post?file=${encodeURIComponent(state.currentFile)}`);
    }
    showToast("已删除", "success");
    newArticle();
    await loadArticles();
  } catch (e) { showToast("删除失败: " + e.message, "error"); }
}

/* ==================== 预览 ==================== */
function updatePreview() {
  const text = $("fContent").value;
  $("preview").innerHTML = parseMarkdown(text);
}

/* ==================== 字数统计 ==================== */
function updateWordCount() {
  const text = $("fContent").value;
  const wc = countWords(text);
  const rt = readTime(text);
  $("wordCount").textContent = `${wc} 字`;
  $("readTime").textContent = `约 ${rt} 分钟`;
}

/* ==================== 保存状态 ==================== */
function updateSaveStatus(status) {
  const dot = $("saveDot");
  const text = $("saveText");
  if (status === "saved") {
    dot.className = "sb-dot saved";
    text.textContent = "已保存";
  } else if (status === "unsaved") {
    dot.className = "sb-dot unsaved";
    text.textContent = "未保存";
  } else {
    dot.className = "sb-dot";
    text.textContent = "";
  }
}

/* ==================== 面包屑 ==================== */
function updateBreadcrumb() {
  const bc = $("breadcrumb");
  if (!state.currentFile) {
    bc.innerHTML = '<span class="bc-status">新文章</span>';
  } else {
    const status = state.isDraft ? "草稿" : "已发布";
    bc.innerHTML = `<span class="bc-status">${status}</span> · ${escHtml(state.currentFile)}`;
  }
}

/* ==================== 显示编辑器 ==================== */
function showEditor() {
  $("emptyState").style.display = "none";
  $("editorArea").style.display = "flex";
}

/* ==================== 视图切换 ==================== */
function setView(view) {
  state.view = view;
  const pane = $("splitPane");
  pane.className = "split-pane mode-" + view;
  document.querySelectorAll(".view-toggle button").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });
}

/* ==================== 侧栏切换 ==================== */
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  $("sidebar").classList.toggle("collapsed", state.sidebarCollapsed);
}

/* ==================== 元数据面板 ==================== */
function toggleMetadata() {
  $("metadataPanel").classList.toggle("expanded");
}

/* ==================== 标签 ==================== */
function renderTags() {
  const wrap = $("tagWrap");
  wrap.innerHTML = "";
  state.allTags.forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "tag-chip" + (state.selectedTags.includes(tag) ? " selected" : "");
    btn.textContent = tag;
    btn.type = "button";
    btn.onclick = () => toggleTag(tag);
    wrap.appendChild(btn);
  });
  const input = document.createElement("input");
  input.className = "tag-input";
  input.placeholder = "+新标签";
  input.type = "text";
  input.onkeydown = e => {
    if (e.key === "Enter") { e.preventDefault(); if (input.value.trim()) { addNewTag(input.value.trim()); input.value = ""; } }
  };
  input.onblur = () => { if (input.value.trim()) { addNewTag(input.value.trim()); input.value = ""; } };
  wrap.appendChild(input);
}

function toggleTag(tag) {
  const idx = state.selectedTags.indexOf(tag);
  if (idx >= 0) state.selectedTags.splice(idx, 1);
  else state.selectedTags.push(tag);
  renderTags();
}

function addNewTag(tag) {
  if (state.selectedTags.includes(tag)) return;
  state.selectedTags.push(tag);
  if (!state.allTags.includes(tag)) { state.allTags.push(tag); state.allTags.sort(); }
  renderTags();
}

/* ==================== 图片上传 ==================== */
async function handleImageUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  await uploadImages(Array.from(files));
  e.target.value = "";
}

async function uploadImages(files) {
  const progress = $("ipUploadProgress");
  progress.style.display = "";
  progress.innerHTML = "";

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const line = document.createElement("div");
    line.className = "ip-progress-line";
    line.innerHTML = `<span class="ip-pl-name">${escHtml(file.name)}</span> <span class="ip-pl-status">上传中…</span>`;
    progress.appendChild(line);

    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/upload-image", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        line.querySelector(".ip-pl-status").textContent = "✓ 已转换为 WebP";
        line.querySelector(".ip-pl-status").className = "ip-pl-status done";
        results.push(data);
      } else {
        line.querySelector(".ip-pl-status").textContent = "✗ " + (data.error || "失败");
        line.querySelector(".ip-pl-status").className = "ip-pl-status fail";
      }
    } catch (err) {
      line.querySelector(".ip-pl-status").textContent = "✗ " + err.message;
      line.querySelector(".ip-pl-status").className = "ip-pl-status fail";
    }
  }

  // 将所有成功上传的图片插入编辑器
  if (results.length > 0) {
    const textarea = $("fContent");
    const pos = textarea.selectionStart;
    const before = textarea.value.substring(0, pos);
    const after = textarea.value.substring(textarea.selectionEnd);
    const insert = results.map(r => `\n![${r.filename}](${r.url})\n`).join("");
    textarea.value = before + insert + after;
    textarea.focus();
    textarea.setSelectionRange(pos + insert.length, pos + insert.length);
    updatePreview();
    updateWordCount();
    markUnsaved();
    showToast(`已插入 ${results.length} 张图片`, "success");
  }

  // 3秒后隐藏进度
  setTimeout(() => { progress.style.display = "none"; }, 3000);
}

/* ==================== 工具栏 ==================== */
function applyFormat(action) {
  const ta = $("fContent");
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.substring(start, end);
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);
  let insert = sel, newStart = start, newEnd = start + sel.length;

  switch (action) {
    case "h1": insertLinePrefix(ta, "# "); break;
    case "h2": insertLinePrefix(ta, "## "); break;
    case "bold": wrapSelection(ta, "**", "**"); break;
    case "italic": wrapSelection(ta, "*", "*"); break;
    case "code": wrapSelection(ta, "`", "`"); break;
    case "link": {
      const text = sel || "链接文字";
      const url = "https://";
      insert = `[${text}](${url})`;
      ta.value = before + insert + after;
      newEnd = start + insert.length;
      ta.focus(); ta.setSelectionRange(newEnd, newEnd);
      break;
    }
    case "image": {
      openImagePicker();
      break;
    }
    case "quote": insertLinePrefix(ta, "> "); break;
    case "ul": insertLinePrefix(ta, "- "); break;
    case "ol": insertLinePrefix(ta, "1. "); break;
    case "hr": {
      insert = "\n---\n";
      ta.value = before + insert + after;
      newEnd = start + insert.length;
      ta.focus(); ta.setSelectionRange(newEnd, newEnd);
      break;
    }
  }
  updatePreview();
  updateWordCount();
  markUnsaved();
}

function wrapSelection(ta, before, after) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const sel = ta.value.substring(start, end);
  const textBefore = ta.value.substring(0, start);
  const textAfter = ta.value.substring(end);
  const insert = before + sel + after;
  ta.value = textBefore + insert + textAfter;
  if (sel) {
    ta.setSelectionRange(start + before.length, start + before.length + sel.length);
  } else {
    ta.setSelectionRange(start + before.length, start + before.length);
  }
  ta.focus();
}

function insertLinePrefix(ta, prefix) {
  const start = ta.selectionStart;
  const value = ta.value;
  // 找到当前行开头
  let lineStart = start;
  while (lineStart > 0 && value[lineStart - 1] !== "\n") lineStart--;
  const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
  ta.value = newValue;
  const newPos = start + prefix.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
}

/* ==================== 自动保存 ==================== */
let autoSaveTimer = null;

function markUnsaved() {
  state.hasChanges = true;
  updateSaveStatus("unsaved");
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveToLocalStorage();
  }, 3000);
}

function saveToLocalStorage() {
  if (!state.currentFile && !$("fTitle").value.trim() && !$("fContent").value.trim()) return;
  const data = {
    title: $("fTitle").value,
    desc: $("fDesc").value,
    author: $("fAuthor").value,
    date: $("fDate").value,
    content: $("fContent").value,
    tags: state.selectedTags,
    currentFile: state.currentFile,
    isDraft: state.isDraft,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(state.autoSaveKey, JSON.stringify(data));
    updateSaveStatus("saved");
  } catch {}
}

function checkAutoSave() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(state.autoSaveKey)); } catch {}
  if (!saved || !saved.content) return;
  const ageMin = Math.round((Date.now() - saved.timestamp) / 60000);
  if (confirm(`检测到 ${ageMin} 分钟前的自动保存内容「${saved.title || "无标题"}」，是否恢复？`)) {
    $("fTitle").value = saved.title || "";
    $("fDesc").value = saved.desc || "";
    $("fAuthor").value = saved.author || "HaxiLin";
    $("fDate").value = saved.date || todayStr();
    $("fContent").value = saved.content || "";
    state.selectedTags = saved.tags || [];
    state.currentFile = saved.currentFile;
    state.isDraft = saved.isDraft;
    renderTags();
    updatePreview();
    updateWordCount();
    updateBreadcrumb();
    showEditor();
    $("btnDelete").style.display = saved.isDraft ? "" : "none";
    showToast("已恢复自动保存的内容", "success");
  } else {
    localStorage.removeItem(state.autoSaveKey);
  }
}

/* ==================== 滚动同步 ==================== */
let isScrolling = false;

function setupScrollSync() {
  const editor = $("fContent");
  const preview = $("preview");

  editor.addEventListener("scroll", () => {
    if (state.view !== "split" || isScrolling) return;
    isScrolling = true;
    const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    requestAnimationFrame(() => { isScrolling = false; });
  });

  preview.addEventListener("scroll", () => {
    if (state.view !== "split" || isScrolling) return;
    isScrolling = true;
    const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight || 1);
    editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
    requestAnimationFrame(() => { isScrolling = false; });
  });
}

/* ==================== 快捷键 ==================== */
function handleKeyDown(e) {
  // Ctrl+S 保存草稿
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveDraft();
    return;
  }
  // Ctrl+Shift+S 发布
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "S" || e.key === "s")) {
    e.preventDefault();
    publish();
    return;
  }
  // 编辑器内的格式快捷键
  if ((e.ctrlKey || e.metaKey) && document.activeElement === $("fContent")) {
    if (e.key === "b") { e.preventDefault(); applyFormat("bold"); return; }
    if (e.key === "i") { e.preventDefault(); applyFormat("italic"); return; }
  }
  // Escape 关闭弹窗
  if (e.key === "Escape") {
    $("shortcutsModal").classList.remove("show");
    $("imagePickerModal").classList.remove("show");
    if (!deployInProgress) $("deployModal").classList.remove("show");
  }
}

/* ==================== 快捷键弹窗 ==================== */
function showShortcuts() {
  $("shortcutsModal").classList.add("show");
}

/* ==================== 图片选择器弹窗 ==================== */
let ipAssets = [];

function openImagePicker() {
  $("imagePickerModal").classList.add("show");
  // 默认显示上传面板
  switchIPTab("upload");
}

function closeImagePicker() {
  $("imagePickerModal").classList.remove("show");
}

function switchIPTab(tab) {
  const uploadBtn = $("ipTabUpload");
  const browseBtn = $("ipTabBrowse");
  const uploadPanel = $("ipUploadPanel");
  const browsePanel = $("ipBrowsePanel");
  if (tab === "upload") {
    uploadBtn.classList.add("active");
    browseBtn.classList.remove("active");
    uploadPanel.style.display = "";
    browsePanel.style.display = "none";
  } else {
    browseBtn.classList.add("active");
    uploadBtn.classList.remove("active");
    uploadPanel.style.display = "none";
    browsePanel.style.display = "";
    loadAssetGallery();
  }
}

async function loadAssetGallery() {
  const gallery = $("ipGallery");
  gallery.innerHTML = '<div class="ip-loading">加载中…</div>';
  try {
    const data = await apiGet("/api/browse-assets");
    if (data.success) {
      ipAssets = data.images || [];
      renderAssetGallery("");
    } else {
      gallery.innerHTML = '<div class="ip-empty">加载失败</div>';
    }
  } catch (e) {
    gallery.innerHTML = '<div class="ip-empty">加载失败: ' + escHtml(e.message) + "</div>";
  }
}

function renderAssetGallery(search) {
  const gallery = $("ipGallery");
  let items = ipAssets;
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(i => i.filename.toLowerCase().includes(q));
  }
  if (items.length === 0) {
    gallery.innerHTML = '<div class="ip-empty">暂无图片</div>';
    return;
  }
  gallery.innerHTML = items.map(img => {
    const sizeKB = (img.size / 1024).toFixed(0);
    const isWebp = img.filename.toLowerCase().endsWith(".webp");
    return `<div class="ip-thumb" onclick="insertAssetImage('${escHtml(img.filename)}', '${escHtml(img.url)}')">
      <div class="ip-thumb-img"><img src="${img.previewUrl}" loading="lazy" alt="${escHtml(img.filename)}"></div>
      <div class="ip-thumb-info">
        <div class="ip-thumb-name">${escHtml(img.filename)}</div>
        <div class="ip-thumb-meta">${sizeKB}KB ${isWebp ? '<span class="ip-webp-badge">WebP</span>' : '<span class="ip-other-badge">非WebP</span>'}</div>
      </div>
    </div>`;
  }).join("");
}

function insertAssetImage(filename, url) {
  const textarea = $("fContent");
  const pos = textarea.selectionStart;
  const before = textarea.value.substring(0, pos);
  const after = textarea.value.substring(textarea.selectionEnd);
  const insert = `\n![${filename}](${url})\n`;
  textarea.value = before + insert + after;
  textarea.focus();
  textarea.setSelectionRange(pos + insert.length, pos + insert.length);
  updatePreview();
  updateWordCount();
  markUnsaved();
  closeImagePicker();
  showToast("已插入图片", "success");
}


let deployEventSource = null;
let deployInProgress = false;

async function checkCfToken() {
  try {
    const data = await apiGet("/api/cf-token");
    const status = $("cfTokenStatus");
    if (data.hasToken) {
      status.textContent = "✓ 已设置";
      status.className = "cf-token-status set";
    } else {
      status.textContent = "未设置";
      status.className = "cf-token-status";
    }
    return data.hasToken;
  } catch {
    return false;
  }
}

async function saveCfToken() {
  const input = $("cfTokenInput");
  const token = input.value.trim();
  if (!token) { showToast("请输入 Token", "error"); return; }
  try {
    await apiPost("/api/cf-token", { token });
    input.value = "";
    showToast("Token 已保存", "success");
    await checkCfToken();
  } catch (e) {
    showToast("保存失败: " + e.message, "error");
  }
}

function openDeployModal() {
  $("deployModal").classList.add("show");
  $("deployLog").innerHTML = "";
  $("deployConfirm").style.display = "";
  $("deployConfirm").disabled = false;
  $("deployConfirm").textContent = "确认部署";
  $("deployCancel").textContent = "关闭";
  updateDeployStatus("idle", "点击「确认部署」开始构建并发布到线上");
  checkCfToken();
}

function closeDeployModal() {
  if (deployInProgress) {
    if (!confirm("部署正在进行中，确定要关闭吗？")) return;
  }
  $("deployModal").classList.remove("show");
  if (deployEventSource) {
    deployEventSource.close();
    deployEventSource = null;
  }
}

function updateDeployStatus(status, text) {
  const icon = $("dsIcon");
  const txt = $("dsText");
  const bar = $("deployStatusBar");

  bar.className = "deploy-status-bar status-" + status;
  txt.textContent = text;

  const icons = { idle: "⏳", building: "🔨", deploying: "📤", success: "✅", error: "❌" };
  icon.textContent = icons[status] || "⏳";
}

function appendDeployLog(type, msg) {
  const log = $("deployLog");
  const line = document.createElement("div");
  line.className = "dl-line dl-" + type;
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });

  const prefix = {
    "info": "ℹ",
    "build": "🔨",
    "build-err": "⚠",
    "deploy": "📤",
    "deploy-err": "⚠",
    "success": "✅",
    "error": "❌",
  };

  line.innerHTML = `<span class="dl-time">${time}</span><span class="dl-prefix">${prefix[type] || "›"}</span><span class="dl-msg">${escHtml(msg)}</span>`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

async function startDeploy() {
  if (deployInProgress) return;
  deployInProgress = true;
  let deploySucceeded = false;
  $("deployConfirm").style.display = "none";
  updateDeployStatus("building", "正在构建 Astro 站点...");

  // 清空日志
  $("deployLog").innerHTML = "";

  // 使用 SSE 接收部署日志
  deployEventSource = new EventSource("/api/deploy");

  deployEventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    appendDeployLog(data.type, data.msg);

    if (data.type === "success" && data.msg.includes("构建成功")) {
      updateDeployStatus("deploying", "正在部署到 Cloudflare Pages...");
    }

    if (data.type === "success" && data.msg.includes("部署成功")) {
      deploySucceeded = true;
      updateDeployStatus("success", "部署完成！站点已上线");
    }

    if (data.type === "error") {
      updateDeployStatus("error", "部署失败，请查看日志");
      deploySucceeded = false;
    }
  };

  deployEventSource.onerror = () => {
    deployInProgress = false;
    if (deployEventSource) {
      deployEventSource.close();
      deployEventSource = null;
    }

    if (deploySucceeded) {
      $("deployCancel").textContent = "关闭";
      showToast("🎉 部署成功！站点已上线", "success");
    } else {
      // 如果还没有收到明确的 error 消息，检查当前状态
      const statusText = $("dsText").textContent;
      if (!statusText.includes("失败")) {
        updateDeployStatus("error", "连接中断，部署可能未完成");
      }
      $("deployConfirm").style.display = "";
      $("deployConfirm").textContent = "重试";
      $("deployConfirm").disabled = false;
    }
  };
}

/* ==================== 初始化 ==================== */
function init() {
  // 事件绑定
  $("btnNew").onclick = newArticle;
  $("btnDraft").onclick = saveDraft;
  $("btnPublish").onclick = publish;
  $("btnDelete").onclick = deleteArticle;
  // 图片选择器
  $("imgBtn").onclick = openImagePicker;
  $("imgInput").onchange = handleImageUpload;
  $("imagePickerClose").onclick = closeImagePicker;
  $("imagePickerModal").onclick = (e) => { if (e.target === $("imagePickerModal")) closeImagePicker(); };
  $("ipTabUpload").onclick = () => switchIPTab("upload");
  $("ipTabBrowse").onclick = () => switchIPTab("browse");
  $("ipSelectBtn").onclick = () => $("imgInput").click();
  $("ipDropZone").onclick = (e) => { if (e.target.id !== "ipSelectBtn") $("imgInput").click(); };
  $("ipRefresh").onclick = loadAssetGallery;
  $("ipSearch").oninput = (e) => renderAssetGallery(e.target.value);

  // 拖拽上传
  const dropZone = $("ipDropZone");
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add("dragover"); };
  dropZone.ondragleave = () => dropZone.classList.remove("dragover");
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) uploadImages(files);
  };

  $("metadataToggle").onclick = toggleMetadata;
  $("btnSidebar").onclick = toggleSidebar;
  $("btnHelp").onclick = showShortcuts;
  $("shortcutsClose").onclick = () => $("shortcutsModal").classList.remove("show");

  // 部署
  $("btnDeploy").onclick = openDeployModal;
  $("deployClose").onclick = closeDeployModal;
  $("deployConfirm").onclick = startDeploy;
  $("deployCancel").onclick = closeDeployModal;
  $("deployModal").onclick = (e) => { if (e.target === $("deployModal")) closeDeployModal(); };

  // Cloudflare Token
  $("cfTokenSave").onclick = saveCfToken;
  $("cfTokenInput").onkeydown = (e) => { if (e.key === "Enter") saveCfToken(); };

  // 搜索
  $("searchInput").oninput = (e) => { state.search = e.target.value; renderArticleList(); };

  // 筛选
  document.querySelectorAll(".sidebar-filters button").forEach(b => {
    b.onclick = () => {
      state.filter = b.dataset.filter;
      document.querySelectorAll(".sidebar-filters button").forEach(x => x.classList.toggle("active", x === b));
      renderArticleList();
    };
  });

  // 视图切换
  document.querySelectorAll(".view-toggle button").forEach(b => {
    b.onclick = () => setView(b.dataset.view);
  });

  // 工具栏
  document.querySelectorAll(".toolbar button[data-action]").forEach(b => {
    b.onclick = () => applyFormat(b.dataset.action);
  });

  // 编辑器实时预览 + 字数统计 + 自动保存
  let debounceTimer = null;
  $("fContent").oninput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updatePreview(), 200);
    updateWordCount();
    markUnsaved();
  };

  $("fTitle").oninput = markUnsaved;
  $("fDesc").oninput = markUnsaved;

  // 滚动同步
  setupScrollSync();

  // 快捷键
  document.addEventListener("keydown", handleKeyDown);

  // 离开页面前保存
  window.addEventListener("beforeunload", () => { if (state.hasChanges) saveToLocalStorage(); });

  // 加载数据
  loadArticles();

  // 检查自动保存
  setTimeout(checkAutoSave, 500);
}

// 启动
document.addEventListener("DOMContentLoaded", init);
