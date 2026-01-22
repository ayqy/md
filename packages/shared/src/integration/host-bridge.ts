import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mountEditorApp } from '@md/web/bootstrap/editorApp'
import type { FeatureFlags } from '@md/web/stores/integration'
import { useIntegrationStore } from '@md/web/stores/integration'
import { useEditorStore } from '@md/web/stores/editor'
import { useExportStore } from '@md/web/stores/export'
import { useRenderStore } from '@md/web/stores/render'
import { useThemeStore } from '@md/web/stores/theme'
import { useUIStore } from '@md/web/stores/ui'
import { addPrefix, generatePureHTML, processClipboardContent } from '@md/web/utils'
import { toast } from '@md/web/utils/toast'
import { initRenderer } from '@md/core'
import { renderMarkdown } from '@md/core/utils'
import { themeMap } from '@md/shared/configs'
import { defaultStyleConfig } from '@md/shared/configs/style'

export interface CreateEditorOptions {
  el: HTMLElement
  value?: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onReady?: () => void
  featureFlags?: Partial<FeatureFlags>
}

export interface RenderResult {
  html: string
  readingTime: {
    words: number
    minutes: number
  }
}

export interface ConfigureOptions {
  theme?: keyof typeof themeMap | string
  fontFamily?: string
  fontSize?: string
  primaryColor?: string
  isMacCodeBlock?: boolean
  isShowLineNumber?: boolean
  isCountStatus?: boolean
  isCiteStatus?: boolean
  featureFlags?: Partial<FeatureFlags>
}

export interface AyqyMdEditorInstance {
  setContent(markdown: string): void
  getContent(): string
  setReadOnly(readOnly: boolean): void
  focus(): void
  destroy(): void
  setOnChange(handler: (value: string) => void): void
}

interface EditorContext {
  pinia: Pinia
  destroy: () => void
}

const instanceContexts = new Map<AyqyMdEditorInstance, EditorContext>()

let cachedRenderer: ReturnType<typeof initRenderer> | null = null

let bridgePinia: Pinia | null = null
let resolveBridgeReady: (() => void) | null = null
let bridgeReadyResolved = false
const bridgeReady = new Promise<void>((resolve) => {
  resolveBridgeReady = resolve
})

const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

const getSafeLocalStorage = (): Storage | null => {
  try {
    return window.localStorage
  }
  catch {
    return null
  }
}

async function waitForEditorRuntime(pinia: Pinia) {
  // 等待 editor view 挂载、renderer 初始化、以及 #output DOM 存在
  // 不设超时：未就绪时允许一直 pending（由宿主策略决定何时创建编辑器）
  // eslint-disable-next-line no-constant-condition
  while (true) {
    setActivePinia(pinia)
    const editorStore = useEditorStore()
    const renderStore = useRenderStore()
    const outputEl = document.getElementById(`output`)

    const hasEditor = !!editorStore.editor
    const hasRenderer = !!renderStore.getRenderer()
    const hasOutputEl = !!outputEl

    if (hasEditor && hasRenderer && hasOutputEl) {
      return
    }

    await nextTick()
    await raf()
  }
}

function markBridgeReady(pinia: Pinia) {
  bridgePinia = pinia
  if (bridgeReadyResolved) {
    return
  }
  bridgeReadyResolved = true
  resolveBridgeReady?.()
}

async function createEditor(options: CreateEditorOptions): Promise<AyqyMdEditorInstance> {
  if (!options?.el) {
    throw new Error(`[AYQYMD] options.el is required`)
  }

  const pinia = createPinia()
  setActivePinia(pinia)

  const integrationStore = useIntegrationStore()
  integrationStore.resetFeatureFlags()
  if (options.featureFlags) {
    integrationStore.setFeatureFlags(options.featureFlags)
  }
  integrationStore.setReadOnlyState(!!options.readOnly)
  integrationStore.setChangeHandler(options.onChange ?? null)

  const editorStore = useEditorStore()

  const { destroy } = await mountEditorApp({ el: options.el, pinia })

  await nextTick()

  if (options.value != null) {
    editorStore.importContent(options.value)
  }

  await nextTick()
  options.onReady?.()

  // bridge 需要支持任何时机调用：只要编辑器完成基础挂载即可标记 ready，
  // 具体 copyToMpHtml 会再等待到渲染与 DOM 就绪
  markBridgeReady(pinia)

  const instance: AyqyMdEditorInstance = {
    setContent(markdown: string) {
      setActivePinia(pinia)
      editorStore.importContent(markdown)
    },
    getContent() {
      setActivePinia(pinia)
      return editorStore.getContent()
    },
    setReadOnly(readOnly: boolean) {
      setActivePinia(pinia)
      integrationStore.setReadOnlyState(readOnly)
    },
    focus() {
      setActivePinia(pinia)
      editorStore.editor?.focus()
    },
    destroy() {
      integrationStore.setChangeHandler(null)
      destroy()
      instanceContexts.delete(instance)
    },
    setOnChange(handler: (value: string) => void) {
      setActivePinia(pinia)
      integrationStore.setChangeHandler(handler)
    },
  }

  instanceContexts.set(instance, { pinia, destroy })
  return instance
}

async function copyToMpHtml(opts: { writeToClipboard: false }): Promise<{ html: string }> {
  if (!opts || opts.writeToClipboard !== false) {
    throw new Error(`writeToClipboard must be false`)
  }

  await bridgeReady

  const pinia = bridgePinia
  if (!pinia) {
    await bridgeReady
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return copyToMpHtml(opts)
  }

  setActivePinia(pinia)
  await waitForEditorRuntime(pinia)

  const editorStore = useEditorStore()
  const exportStore = useExportStore()
  const renderStore = useRenderStore()
  const themeStore = useThemeStore()
  const uiStore = useUIStore()

  const raw = editorStore.getContent()

  const copyModeKey = addPrefix(`copyMode`)
  const ls = getSafeLocalStorage()
  const copyMode = ((ls ? ls.getItem(copyModeKey) : null) || `txt`) as
    | `txt`
    | `html`
    | `html-without-style`
    | `html-and-style`
    | `md`

  function editorRefresh() {
    themeStore.updateCodeTheme()
    renderStore.render(editorStore.getContent(), {
      isCiteStatus: themeStore.isCiteStatus,
      legend: themeStore.legend,
      isUseIndent: themeStore.isUseIndent,
      isUseJustify: themeStore.isUseJustify,
      isCountStatus: themeStore.isCountStatus,
      isMacCodeBlock: themeStore.isMacCodeBlock,
      isShowLineNumber: themeStore.isShowLineNumber,
    })
  }

  if (copyMode === `md`) {
    toast.success(`已复制 Markdown 源码到剪贴板。`)
    return { html: raw }
  }

  uiStore.startCopy()

  try {
    await delay(350)
    await nextTick()

    await processClipboardContent(themeStore.primaryColor)

    // processClipboardContent 内部会强依赖 #output，因此这里再次兜底等待
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const outputEl = document.getElementById(`output`) as HTMLElement | null
      if (outputEl) {
        outputEl.focus()
        window.getSelection()?.removeAllRanges()

        const temp = outputEl.innerHTML
        outputEl.innerHTML = renderStore.output

        let writtenContent = ``
        if (copyMode === `txt` || copyMode === `html`) {
          writtenContent = temp
        }
        else if (copyMode === `html-without-style`) {
          writtenContent = await generatePureHTML(raw)
        }
        else if (copyMode === `html-and-style`) {
          writtenContent = exportStore.editorContent2HTML()
        }
        else {
          writtenContent = temp
        }

        toast.success(
          copyMode === `html`
            ? `已复制 HTML 源码，请进行下一步操作。`
            : `已复制渲染后的内容到剪贴板，可直接到公众号后台粘贴。`,
        )

        window.dispatchEvent(
          new CustomEvent(`copyToMp`, {
            detail: {
              content: renderStore.output,
            },
          }),
        )

        editorRefresh()
        uiStore.endCopy()

        return { html: writtenContent }
      }

      await nextTick()
      await raf()
    }
  }
  catch (error) {
    try {
      const outputEl = document.getElementById(`output`)
      if (outputEl) {
        outputEl.innerHTML = renderStore.output
      }
      editorRefresh()
    }
    catch {
    }
    finally {
      uiStore.endCopy()
    }

    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message)
  }
}

function render(markdown: string): RenderResult {
  if (!cachedRenderer) {
    const defaultThemeKey = defaultStyleConfig.theme as keyof typeof themeMap
    const baseTheme = themeMap[defaultThemeKey] ?? Object.values(themeMap)[0]
    cachedRenderer = initRenderer({
      theme: baseTheme,
      fonts: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
      size: `16px`,
      isUseIndent: false,
      isUseJustify: false,
      isMacCodeBlock: true,
      isShowLineNumber: false,
    })
  }

  const { html, readingTime } = renderMarkdown(markdown, cachedRenderer)
  return {
    html,
    readingTime: {
      words: readingTime.words,
      minutes: Math.ceil(readingTime.minutes),
    },
  }
}

function configure(options: ConfigureOptions) {
  instanceContexts.forEach(({ pinia }) => {
    setActivePinia(pinia)

    const themeStore = useThemeStore()
    const integrationStore = useIntegrationStore()

    if (options.theme) {
      const key = options.theme as keyof typeof themeMap
      if (themeMap[key]) {
        themeStore.theme = key
      }
    }
    if (options.fontFamily) {
      themeStore.fontFamily = options.fontFamily
    }
    if (options.fontSize) {
      themeStore.fontSize = options.fontSize
    }
    if (options.primaryColor) {
      themeStore.primaryColor = options.primaryColor
    }
    if (options.isMacCodeBlock != null) {
      themeStore.isMacCodeBlock = options.isMacCodeBlock
    }
    if (options.isShowLineNumber != null) {
      themeStore.isShowLineNumber = options.isShowLineNumber
    }
    if (options.isCountStatus != null) {
      themeStore.isCountStatus = options.isCountStatus
    }
    if (options.isCiteStatus != null) {
      themeStore.isCiteStatus = options.isCiteStatus
    }

    if (options.featureFlags) {
      integrationStore.setFeatureFlags({
        ...integrationStore.featureFlags,
        ...options.featureFlags,
      })
    }
  })
}

export const AYQYMD = {
  createEditor,
  render,
  configure,
}

declare global {
  interface Window {
    AYQYMD?: typeof AYQYMD
    __AYQYMD_HOST_BRIDGE__?: {
      copyToMpHtml(opts: { writeToClipboard: false }): Promise<{ html: string }>
    }
  }
}

if (typeof window !== `undefined`) {
  window.AYQYMD = AYQYMD
  window.__AYQYMD_HOST_BRIDGE__ = {
    copyToMpHtml,
  }
}
