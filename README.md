# VitePress 文档站点

这是一个面向公开阅读场景的 VitePress 文档站点。文档和图片均保存在 Git 仓库中。

## 本地开发

```bash
npm install
npm run docs:dev
```

默认访问地址为 <http://localhost:5173>。

## 构建与预览

```bash
npm run docs:build
npm run docs:preview
```

生产文件生成在 `docs/.vitepress/dist/`，可以部署到 Nginx 或其他静态文件服务。

## 自动部署

项目包含 GitHub Actions 自动部署工作流。推送到 `main` 分支后，GitHub 会构建文档并通过 SSH 发布到 Nginx 服务器。

首次配置请阅读 [GitHub Actions 自动部署指南](deploy/README.md)。

也可以运行交互式向导，它会逐步完成 Debian 12、GitHub Secrets、Nginx 和 Cloudflare HTTPS 配置：

```bash
./scripts/setup-github-deploy.sh
```

## 内容维护

- 在 `docs/guide/` 中添加 Markdown 文档。
- 在 `docs/.vitepress/config.mts` 中维护顶部导航和侧边栏。
- 在 `docs/.vitepress/theme/custom.css` 中调整颜色、字体和页面样式。
- 文章专用图片放在文章旁边的 `images/` 目录。
- 多篇文章共用的图片放在 `docs/public/images/` 目录。
