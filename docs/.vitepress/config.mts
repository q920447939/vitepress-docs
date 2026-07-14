import { defineConfig } from 'vitepress'

const sharedSidebar = [
  {
    text: '中转站',
    collapsed: false,
    items: [
      { text: '中转站充值', link: '/guide/hub/exchange-balance' },
      { text: '中转站密钥使用教程', link: '/guide/hub/api-key-use' },
      { text: 'CC Switch使用教程', link: '/guide/hub/ccs-tutorial' },
    ],
  },
  {
    text: '拼车',
    collapsed: false,
    items: [
      { text: '拼车方案', link: '/rider/' },
    ],
  },
  {
    text: 'Claude',
    collapsed: false,
    items: [
      { text: 'Claude降低封号', link: '/claude/' },
    ],
  },
]

export default defineConfig({
  lang: 'zh-CN',
  title: '我的文档',
  description: '使用文档',
  cleanUrls: true,
  lastUpdated: true,

  head: [['meta', { name: 'theme-color', content: '#ffffff' }]],

  themeConfig: {
    sidebar: {
      '/guide/': sharedSidebar,
      '/rider/': sharedSidebar,
      '/claude/': sharedSidebar,
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
