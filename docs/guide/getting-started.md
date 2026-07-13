# 快速开始

这个站点使用 VitePress 将 Markdown 文件生成静态网页。访问者不需要注册或登录，服务器也不需要数据库。

## 启动本地站点

在项目目录执行：

```bash
npm install
npm run docs:dev
```

然后访问 `http://localhost:5173`。开发服务器会监听文件变化，保存 Markdown 后页面会自动刷新。

## 构建生产文件

```bash
npm run docs:build
```

构建结果位于 `docs/.vitepress/dist/`。该目录中的文件可以直接交给 Nginx 或其他静态文件服务。

## 构建后预览

```bash
npm run docs:preview
```

发布前使用预览命令检查生产构建，避免只在开发模式下验证页面。
