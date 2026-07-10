# HaxiLin Studio — 博客编辑器

独立博客管理工具，用于本地编辑 HaxiLin Studio 网站的博客文章。

## 使用方式

```bash
cd admin-tool
npm install
npm start
```

然后浏览器打开 **http://localhost:3000**

## 功能

- 📝 新建博客文章（标题、简介、标签、正文）
- 🏷️ 标签自动记忆（历史标签一键点击添加）
- 🖼️ 图片上传（自动转为 webp，保存到 assets）
- 💾 草稿箱（暂存、继续编辑、删除）
- 📖 编辑已发布文章
- 📤 一键发布

## 数据流向

编辑器直接读写 Astro 项目的 `src/blog/` 和 `src/assets/` 目录。
写完文章后，刷新 Astro 开发服务器即可看到效果。

## 注意事项

- 仅限本地开发使用，不会部署到网站
- 需要 Node.js 22+
- 依赖 express、sharp、multer