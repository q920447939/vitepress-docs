import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '我的文档',
  description: '公开产品使用文档',
  cleanUrls: true,
  lastUpdated: true,

  head: [['meta', { name: 'theme-color', content: '#ffffff' }]],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
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
              { text: '配置菜单', link: '/guide/navigation' },
            ],
          },
        ],
      },
    ],

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
            { text: '配置菜单', link: '/guide/navigation' },
          ],
        },
      ],
    },

    outline: {
      label: '本页目录',
      level: [2, 3],
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },

    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '文档目录',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
})
