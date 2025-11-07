# AYQY Markdown Host Bridge 集成指南

> 更新日期：2025-11-06

本文档介绍如何构建并在宿主（例如 Next.js 项目）中接入子模块导出的 `window.AYQYMD` 接口。

## 1. 构建产物

在仓库根目录执行：

```bash
pnpm install
pnpm --filter @md/web build
```

成功后将在 `apps/web/dist/host/` 目录生成以下文件（名称可能附带哈希，由 `manifest-host.json` 指定）：

| 文件 | 说明 |
| ---- | ---- |
| `md-host-bridge.js` | IIFE 形式的宿主桥接脚本，向 `window` 挂载 `AYQYMD` |
| `static/css/*.css` | 宿主所需样式，需在宿主页面中加载 |
| `static/**` | 运行期依赖的其他静态资源（若存在） |
| `manifest-host.json` | 产物映射文件，列出 JS、CSS、其它资源在 dist 中的相对路径 |

> 注意：`build` 脚本会同时执行 Web 主应用构建与宿主桥构建。若仅需宿主桥，可运行 `pnpm --filter @md/web build:host`。

## 2. 在宿主中加载资源

1. 将 `apps/web/dist/host` 目录复制或部署到宿主项目可访问的静态目录（例如 `public/md/`）。
2. 读取 `manifest-host.json` 并按顺序注入资源：

```ts
import manifest from './public/md/manifest-host.json'

manifest.styles.forEach((href) => {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `/md/${href}`
  document.head.appendChild(link)
})

const script = document.createElement('script')
script.src = `/md/${manifest.bridge}`
script.defer = true
document.head.appendChild(script)
```

> `manifest.assets` 若包含额外资源（字体、图片），请确保同步复制并按需加载。

## 3. 全局接口说明

宿主桥在脚本执行后向 `window` 注入：

```ts
interface Window {
  AYQYMD?: {
    createEditor(options: CreateEditorOptions): Promise<AyqyMdEditorInstance>
    render(markdown: string): RenderResult
    configure(options: ConfigureOptions): void
  }
}
```

### 3.1 `createEditor`

```ts
interface CreateEditorOptions {
  el: HTMLElement                // 宿主提供的空容器
  value?: string                 // 初始 Markdown 内容
  readOnly?: boolean             // 只读模式（默认 false）
  onChange?: (value: string) => void
  onReady?: () => void
  featureFlags?: Partial<FeatureFlags>
}

interface FeatureFlags {
  ai: boolean
  postManagement: boolean
  cssEditor: boolean
  exportPanel: boolean
  uploadImage: boolean
}

interface AyqyMdEditorInstance {
  setContent(markdown: string): void
  getContent(): string
  setReadOnly(readOnly: boolean): void
  focus(): void
  setOnChange(handler: (value: string) => void): void
  destroy(): void
}
```

调用示例：

```ts
const container = document.getElementById('editor-root')!

const editor = await window.AYQYMD!.createEditor({
  el: container,
  value: '# Hello AYQY',
  featureFlags: { ai: false, cssEditor: false },
  onChange(value) {
    console.log('content updated', value.length)
  },
  onReady() {
    console.log('editor ready')
  },
})

// 只读切换
editor.setReadOnly(true)
```

### 3.2 `render`

```ts
interface RenderResult {
  html: string                  // 处理后的 HTML（含阅读信息、附加样式）
  readingTime: {
    words: number
    minutes: number
  }
}

const { html, readingTime } = window.AYQYMD!.render('# markdown **text**')
```

### 3.3 `configure`

```ts
window.AYQYMD!.configure({
  theme: 'wechat',              // 参见 packages/shared/src/configs/theme.ts
  fontFamily: 'Menlo, monospace',
  fontSize: '18px',
  primaryColor: '#0F4C81',
  isMacCodeBlock: true,
  featureFlags: { exportPanel: false },
})
```

`configure` 会对所有已创建的编辑器实例生效；仅传入需要变更的字段即可。

## 4. Next.js 集成示例

```tsx
// app/editor/page.tsx (Next.js 13+)
import { useEffect, useRef, useState } from 'react'
import manifest from '@/public/md/manifest-host.json'

function loadBridge() {
  manifest.styles.forEach((href) => {
    if (document.querySelector(`link[data-ayqymd="${href}"]`))
      return
    const link = document.createElement('link')
    link.dataset.ayqymd = href
    link.rel = 'stylesheet'
    link.href = `/md/${href}`
    document.head.appendChild(link)
  })

  return new Promise<void>((resolve) => {
    if (window.AYQYMD) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `/md/${manifest.bridge}`
    script.dataset.ayqymd = 'bridge'
    script.onload = () => resolve()
    document.body.appendChild(script)
  })
}

export default function EditorPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    loadBridge().then(async () => {
      if (!containerRef.current || !window.AYQYMD)
        return

      const instance = await window.AYQYMD.createEditor({
        el: containerRef.current,
        value: '# Hello from Next.js',
        onChange: setContent,
      })

      return () => instance.destroy()
    })
  }, [])

  return (
    <div className="grid grid-cols-2 gap-4">
      <div ref={containerRef} />
      <pre>{content}</pre>
    </div>
  )
}
```

## 5. 注意事项

- 构建脚本不会清空 `dist/host`，如需重新部署请手动清理旧文件。
- 若使用 CDN，请确保 CSS 引入顺序与 manifest 中一致，否则主题变量可能失效。
- 图片上传、AI 工具等依赖外部配置，宿主若无对应后端，请通过 `featureFlags` 关闭相关功能。
- 若宿主页面自身加载了 Tailwind 或其他全局样式，请注意命名冲突（桥接样式已尽可能局部化）。

如发现接口变更或需要新增功能，请更新 `docs/prd/v0-implementation-plan.md` 并同步本指南。***
