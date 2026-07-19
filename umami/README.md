# Umami 自托管部署指南（Cloudflare Pages + D1）

> 本目录存放 Umami 自托管所需的本地配置文件和部署清单。
> 实际部署需要你在浏览器和 Cloudflare 后台操作。

## 部署路线

Umami 官方仓库基于 Next.js + Prisma + PostgreSQL，**不适合直接部署到 Cloudflare Pages**。
推荐使用社区维护的 Cloudflare 适配分支：

- **`umami-software/umami-cloudflare`**（如果存在）—— 官方 Cloudflare 适配
- 或 fork 官方 `umami-software/umami` 后自行适配

## 步骤 1：登录 wrangler（一次性）

```bash
cd D:/ai/haxilin
npx wrangler login
```

浏览器会弹出 Cloudflare 授权页 → 点 **Allow**。

## 步骤 2：创建 D1 数据库

```bash
npx wrangler d1 create umami-db
```

命令输出类似：

```
[[d1_databases]]
binding = "DB"
database_name = "umami-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**记下这个 database_id**，下一步要用。

## 步骤 3：初始化数据库 Schema

Umami 的 schema 由 Prisma 迁移生成。Cloudflare D1 适配版会提供 `schema.sql` 文件。

把该文件放到本目录后执行：

```bash
npx wrangler d1 execute umami-db --remote --file=./umami/schema.sql
```

## 步骤 4：在 Cloudflare Pages 后台部署

1. 浏览器访问 https://dash.cloudflare.com → **Workers & Pages**
2. 点 **Create** → **Pages** → **Connect to Git**
3. 选择你 fork 的 umami 仓库
4. 构建设置（参考 umami-cloudflare 项目 README）：
   - **Framework preset**: Next.js (Static HTML Export) 或 Cloudflare Workers
   - **Build command**: `npm run build`
   - **Build output directory**: 视适配方案而定
5. 添加环境变量：
   - `DATABASE_URL` = D1 连接串
   - `NEXT_AUTH_SECRET` = 32 位随机字符串
   - `NEXTAUTH_URL` = 部署后的 Umami 站点 URL
6. 点 **Save and Deploy**

## 步骤 5：访问 Umami 后台配置网站

部署成功后：

1. 访问你的 Umami 站点（如 `https://umami.<你的域名>/`）
2. 用默认账号登录：
   - 用户名：`admin`
   - 密码：`umami`
3. **Settings → Websites → Add website**
4. 填入：
   - Name: `HaxiLin Studio`
   - Domain: `x.zcgo.top`（你的站点域名）
5. 保存后点 **View → Tracking code**
6. **复制这段 tracking script**，贴给我，我会注入到 `BaseLayout.astro`

## 步骤 6：本地验证

```bash
cd D:/ai/haxilin
npm run build
npx wrangler pages dev dist/
```

浏览器访问 http://localhost:8788，确认：
- Giscus 评论区正常加载（需要能访问 github.com）
- 文章页底部出现 "评论" 标题
- 关于页面底部出现评论区

## 注意事项

1. **Umami Cloudflare 适配方案的成熟度**：Umami 官方主线仍以 Vercel/PostgreSQL 为主，
   Cloudflare 适配版本可能滞后。如果遇到 Prisma + D1 兼容问题，回退到 Vercel 免费层
   部署 Umami，本站只用 tracking script 即可（数据归 Umami 实例，不归本站）。

2. **域名规划建议**：
   - 主站 `x.zcgo.top`（haxilin-studio，已有）
   - 统计后台 `stats.zcgo.top` 或 `umami.<account>.pages.dev`（Umami 实例）
   - 后台管理 `admin.<account>.pages.dev`（admin-tool，未来可考虑）

3. **免费额度核算**：
   - Cloudflare D1：免费 5GB 存储 + 500 万次读/天 + 10 万次写/天
   - Cloudflare Pages：免费 100 万次请求/天
   - 个人博客访客量级（< 1 万/天）完全够用

## 故障排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `wrangler login` 无响应 | 浏览器未打开 | 手动复制终端显示的 URL 到浏览器 |
| D1 创建失败 | 账号未绑定 Workers 计划 | Cloudflare 后台 → Workers & Pages → 启用免费计划 |
| Umami 部署构建失败 | Prisma 与 D1 适配问题 | 改用 PostgreSQL 托管（Neon / Supabase 免费层） |
| Tracking script 不统计 | 浏览器广告拦截器屏蔽 | 把 tracking script 域名改成自己的自定义域名 |

## 替代方案（如果 Umami 自托管太折腾）

1. **Cloudflare Web Analytics**：站点已在 Cloudflare，后台一键开启，5 分钟落地。
   缺点：数据只在 Cloudflare 后台看，前端不显示 widget。

2. **Umami Cloud 托管版**（umami.is）：免费 3 网站，省去自托管运维。
   适合不想折腾服务器的人。

3. **Busuanzi**：一行 script 接入，前端可直接显示阅读量 widget。
   缺点：数据归第三方（busuanzi.ibruce.info），服务可用性不受控。
