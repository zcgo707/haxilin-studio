import express from "express";
import multer from "multer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ==================== 路径 ==================== */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(PROJECT_ROOT, "src", "blog");
const ASSETS_DIR = path.join(PROJECT_ROOT, "src", "assets");
const DRAFTS_DIR = path.join(BLOG_DIR, "_drafts");

/* ==================== 工具 ==================== */
function readFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: "", description: "", author: "", pubDate: "", tags: [] };

  const fm = match[1];
  const get = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : null;
  };

  const title = get("title")?.replace(/^'|'$/g, "").replace(/^"|"$/g, "") || "";
  const description = get("description")?.replace(/^'|'$/g, "").replace(/^"|"$/g, "") || "";
  const author = get("author")?.replace(/^'|'$/g, "").replace(/^"|"$/g, "") || "";
  const pubDate = get("pubDate") || "";

  let tags = [];
  const tagsMatch = fm.match(/^tags:\s*\[([\s\S]*?)\]/m);
  if (tagsMatch) {
    tags = tagsMatch[1]
      .split(",")
      .map((t) => t.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""))
      .filter(Boolean);
  }

  let image = undefined;
  const imageUrl = fm.match(/^image:\n\s+url:\s*(.+)$/m)?.[1]?.trim();
  if (imageUrl) {
    const imageAlt = fm.match(/^\s+alt:\s*(.+)$/m)?.[1]?.replace(/^'|'$/g, "").replace(/^"|"$/g, "") || "";
    image = { url: imageUrl, alt: imageAlt };
  }

  return { title, description, author, pubDate, tags, image };
}

function buildFrontmatter({ title, description, author, pubDate, tags, image, imageAlt }) {
  let fm = "---\n";
  fm += `title: '${title.replace(/'/g, "\\'")}'\n`;
  fm += `description: '${description.replace(/'/g, "\\'")}'\n`;
  fm += `author: '${(author || "HaxiLin").replace(/'/g, "\\'")}'\n`;
  fm += `pubDate: ${pubDate}\n`;

  const tagsStr = tags.map((t) => `"${t}"`).join(", ");
  fm += `tags: [${tagsStr}]\n`;

  if (image) {
    fm += `image:\n  url: ../assets/${image}\n`;
    fm += `  alt: '${(imageAlt || image).replace(/'/g, "\\'")}'\n`;
  }

  fm += "---\n\n";
  return fm;
}

function generateSlug(title) {
  return title
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/* ==================== App ==================== */
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

// JSON body parser
app.use(express.json({ limit: "10mb" }));

// 静态文件
app.use(express.static(path.join(__dirname, "public")));

// 确保草稿目录存在
function ensureDraftsDir() {
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }
}

/* ==================== API 路由 ==================== */

// GET /api/list — 列出所有已发布文章
app.get("/api/list", (req, res) => {
  try {
    const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    const posts = files.map((f) => {
      const fm = readFrontmatter(path.join(BLOG_DIR, f));
      return { filename: f, ...fm };
    });
    posts.sort((a, b) => new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf());
    res.json({ success: true, posts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/get?file=xxx.md — 获取单篇文章
app.get("/api/get", (req, res) => {
  try {
    const file = req.query.file;
    if (!file) return res.status(400).json({ success: false, error: "缺少 file 参数" });

    const resolved = path.resolve(BLOG_DIR, file);
    if (!resolved.startsWith(BLOG_DIR))
      return res.status(400).json({ success: false, error: "非法路径" });
    if (!fs.existsSync(resolved))
      return res.status(404).json({ success: false, error: "文件不存在" });

    const raw = fs.readFileSync(resolved, "utf-8");
    const fm = readFrontmatter(resolved);
    const content = raw.replace(/^---[\s\S]*?---\n*/, "").trim();
    res.json({ success: true, file, frontmatter: fm, content });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/save — 发布文章
app.post("/api/save", (req, res) => {
  try {
    const { title, description, author, pubDate, tags, content, image, imageAlt, filename } = req.body;

    if (!title || !description || !content)
      return res.status(400).json({ success: false, error: "标题、简介、正文不能为空" });
    if (!tags || tags.length === 0)
      return res.status(400).json({ success: false, error: "至少需要一个标签" });

    const fm = buildFrontmatter({ title, description, author, pubDate, tags, image, imageAlt });
    const fullContent = fm + content.trim() + "\n";
    const saveFilename = filename || `${pubDate}-${generateSlug(title)}.md`;
    fs.writeFileSync(path.join(BLOG_DIR, saveFilename), fullContent, "utf-8");
    res.json({ success: true, filename: saveFilename });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/drafts — 列出所有草稿
app.get("/api/drafts", (req, res) => {
  try {
    ensureDraftsDir();
    const files = fs.readdirSync(DRAFTS_DIR).filter((f) => f.endsWith(".md"));
    const drafts = files.map((f) => {
      const raw = fs.readFileSync(path.join(DRAFTS_DIR, f), "utf-8");
      const title = raw.match(/^title:\s*'([^']*)'/m)?.[1] || raw.match(/^title:\s*"([^"]*)"/m)?.[1] || f;
      const pubDate = raw.match(/^pubDate:\s*([\d-]+)/m)?.[1] || "";
      const stat = fs.statSync(path.join(DRAFTS_DIR, f));
      return { filename: f, title, pubDate, modified: stat.mtime.toISOString() };
    });
    drafts.sort((a, b) => new Date(b.modified).valueOf() - new Date(a.modified).valueOf());
    res.json({ success: true, drafts });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/draft?file=xxx.md — 获取单个草稿
app.get("/api/draft", (req, res) => {
  try {
    const file = req.query.file;
    if (!file) return res.status(400).json({ success: false, error: "缺少 file 参数" });

    const resolved = path.resolve(DRAFTS_DIR, file);
    if (!resolved.startsWith(DRAFTS_DIR))
      return res.status(400).json({ success: false, error: "非法路径" });
    if (!fs.existsSync(resolved))
      return res.status(404).json({ success: false, error: "草稿不存在" });

    const raw = fs.readFileSync(resolved, "utf-8");
    const fm = readFrontmatter(resolved);
    const body = raw.replace(/^---[\s\S]*?---\n*/, "").trim();
    res.json({ success: true, ...fm, content: body });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/draft — 保存草稿
app.post("/api/draft", (req, res) => {
  try {
    ensureDraftsDir();
    const { title, description, author, pubDate, tags, content, image, imageAlt, filename } = req.body;

    if (!title || !description || !content)
      return res.status(400).json({ success: false, error: "标题、简介、正文不能为空" });

    const fm = buildFrontmatter({ title, description, author, pubDate, tags, image, imageAlt });
    const fullContent = fm + content.trim() + "\n";
    const draftFilename = filename || `${pubDate}-${generateSlug(title)}.md`;
    fs.writeFileSync(path.join(DRAFTS_DIR, draftFilename), fullContent, "utf-8");
    res.json({ success: true, filename: draftFilename });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/draft?file=xxx.md — 删除草稿
app.delete("/api/draft", (req, res) => {
  try {
    const file = req.query.file;
    if (!file) return res.status(400).json({ success: false, error: "缺少 file 参数" });

    const resolved = path.resolve(DRAFTS_DIR, file);
    if (!resolved.startsWith(DRAFTS_DIR))
      return res.status(400).json({ success: false, error: "非法路径" });
    if (!fs.existsSync(resolved))
      return res.status(404).json({ success: false, error: "草稿不存在" });

    fs.unlinkSync(resolved);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/upload-image — 上传图片转 webp
app.post("/api/upload-image", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: "请选择图片文件" });

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.mimetype))
      return res.status(400).json({ success: false, error: "仅支持 JPG/PNG/GIF/WebP 格式" });

    const originalName = file.originalname.replace(/\.[^.]+$/, "");
    const safeName = originalName
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const timestamp = Date.now();
    const webpFilename = `ascendlab-${timestamp}-${safeName}.webp`;
    const outputPath = path.join(ASSETS_DIR, webpFilename);

    if (file.mimetype === "image/webp") {
      // webp 直接复制，无需转换
      fs.writeFileSync(outputPath, file.buffer);
    } else {
      // 其他格式转 webp
      await sharp(file.buffer).webp({ quality: 85 }).toFile(outputPath);
    }

    res.json({
      success: true,
      filename: webpFilename,
      url: `../assets/${webpFilename}`,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/* ==================== 启动 ==================== */
function startServer(port) {
  const server = app.listen(port);
  server.on("listening", () => {
    console.log(`\n  ✏️  博客编辑器已启动`);
    console.log(`  ─────────────────────────`);
    console.log(`  地址: http://localhost:${port}`);
    console.log(`  文章目录: ${BLOG_DIR}`);
    console.log(`  图片目录: ${ASSETS_DIR}\n`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`  ⚠️  端口 ${port} 已被占用，尝试端口 ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("  ❌ 启动失败:", err.message);
      process.exit(1);
    }
  });
}

startServer(PORT);