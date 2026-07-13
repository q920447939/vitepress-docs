# 配置导航与菜单

所有菜单集中配置在 `docs/.vitepress/config.mts` 的 `themeConfig` 中。页面创建完成后，需要在这里为它添加入口。

## 顶部导航

`nav` 控制页面顶部的导航。最简单的菜单项由显示文字和链接组成：

```ts
nav: [
  { text: '首页', link: '/' },
  { text: '使用指南', link: '/guide/getting-started' },
]
```

`text` 是用户看到的名称，`link` 是站内页面路径。链接不需要填写 `.md` 扩展名。

## 顶部下拉菜单

当一个栏目包含多个页面时，用 `items` 创建下拉菜单：

```ts
{
  text: '使用指南',
  activeMatch: '/guide/',
  items: [
    { text: '快速开始', link: '/guide/getting-started' },
    {
      text: '内容维护',
      items: [
        { text: '编写文档', link: '/guide/writing' },
        { text: '管理图片', link: '/guide/images' },
      ],
    },
  ],
}
```

`activeMatch` 用于匹配当前栏目。当访问 `/guide/` 下的任意页面时，“使用指南”会保持选中状态。

## 侧边栏

`sidebar` 按路径前缀决定显示哪组目录。下面的配置只会出现在 `/guide/` 栏目：

```ts
sidebar: {
  '/guide/': [
    {
      text: '开始使用',
      items: [
        { text: '快速开始', link: '/guide/getting-started' },
      ],
    },
    {
      text: '内容维护',
      items: [
        { text: '编写文档', link: '/guide/writing' },
        { text: '管理图片', link: '/guide/images' },
      ],
    },
  ],
}
```

如果需要让某一组默认折叠，可以增加 `collapsed: true`：

```ts
{
  text: '高级配置',
  collapsed: true,
  items: [
    { text: '部署说明', link: '/guide/deployment' },
  ],
}
```

## 新增一个页面

假设要新增“常见问题”：

1. 创建 `docs/guide/faq.md`。
2. 在文件中写入一级标题 `# 常见问题`。
3. 在侧边栏的 `items` 中加入 `{ text: '常见问题', link: '/guide/faq' }`。
4. 如果也需要顶部入口，再将相同链接加入 `nav` 的下拉菜单。
5. 执行 `npm run docs:dev` 检查菜单，再执行 `npm run docs:build` 验证链接。

## 多个文档栏目

如果未来增加 `/api/` 栏目，可以为它配置独立侧边栏：

```ts
sidebar: {
  '/guide/': [
    // 使用指南目录
  ],
  '/api/': [
    {
      text: '接口文档',
      items: [
        { text: '接口概览', link: '/api/index' },
      ],
    },
  ],
}
```

路径前缀和 Markdown 所在目录保持一致，文档数量增加后仍然容易维护。
