import type { App as VueApp } from 'vue'

import { initializeMermaid } from '@md/core/utils'
import type { Pinia } from 'pinia'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from '../App.vue'
import { setupComponents } from '../utils/setup-components'

let componentsRegistered = false

export interface MountEditorAppOptions {
  el: HTMLElement
  pinia?: Pinia
}

export interface EditorAppHandle {
  app: VueApp
  pinia: Pinia
  destroy(): void
}

export async function mountEditorApp(options: MountEditorAppOptions): Promise<EditorAppHandle> {
  if (!options?.el) {
    throw new Error(`[mountEditorApp] option "el" is required`)
  }

  if (!componentsRegistered) {
    setupComponents()
    componentsRegistered = true
  }

  await initializeMermaid().catch(console.error)

  const app = createApp(App)
  const pinia = options.pinia ?? createPinia()
  app.use(pinia)
  app.mount(options.el)

  let destroyed = false
  return {
    app,
    pinia,
    destroy() {
      if (destroyed)
        return
      app.unmount()
      options.el.innerHTML = ``
      destroyed = true
    },
  }
}
