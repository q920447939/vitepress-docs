# 编写文档

文档使用标准 Markdown 编写。每个 Markdown 文件对应一个网页。

## 新建页面

例如，新建 `docs/guide/faq.md`：

```markdown
# 常见问题

## 如何开始使用？

按照快速开始中的步骤完成配置。
```

页面地址将是 `/guide/faq`。

## 加入侧边栏

打开 `docs/.vitepress/config.mts`，在对应的 `items` 中增加页面：

```ts
{ text: '常见问题', link: '/guide/faq' }
```

## 标题层级

每篇文档只使用一个一级标题。正文从二级标题开始，必要时再使用三级标题：

```markdown
# 页面标题

## 主要章节

### 章节细节
```

右侧的本页目录会自动收集二级和三级标题。
