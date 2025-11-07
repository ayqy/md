import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mountEditorApp } from '@md/web/bootstrap/editorApp'
import type { FeatureFlags } from '@md/web/stores/integration'
import { useIntegrationStore } from '@md/web/stores/integration'
import { useEditorStore } from '@md/web/stores/editor'
import { useThemeStore } from '@md/web/stores/theme'
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
  }
}

if (typeof window !== `undefined`) {
  window.AYQYMD = AYQYMD
}
