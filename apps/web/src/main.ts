import { mountEditorApp } from './bootstrap/editorApp'

import 'vue-sonner/style.css'

/* 每个页面公共css */
import '@/assets/index.css'
import '@/assets/less/theme.less'

const el = document.getElementById(`app`)
if (!el) {
  console.error(`[main] cannot find element #app`)
}
else {
  mountEditorApp({ el }).catch((err) => {
    console.error(`[main] failed to mount editor app`, err)
  })
}
