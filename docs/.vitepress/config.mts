import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '我的文档',
  description: '使用文档',
  cleanUrls: true,
  lastUpdated: true,

  head: [['meta', { name: 'theme-color', content: '#ffffff' }]],

  themeConfig: {
    sidebar: {
      '/guide/': [
        {
          text: '中转站',
          collapsed: false,
          items: [
            {
              text: '配置指南',
              collapsed: false,
              items: [
                { text: '中转站配置', link: '/guide/hub/getting-start' },
              ],
            },
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
