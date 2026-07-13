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

## 内容维护

- 在 `docs/guide/` 中添加 Markdown 文档。
- 在 `docs/.vitepress/config.mts` 中维护顶部导航和侧边栏。
- 文章专用图片放在文章旁边的 `images/` 目录。
- 多篇文章共用的图片放在 `docs/public/images/` 目录。
