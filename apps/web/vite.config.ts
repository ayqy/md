import path from 'node:path'
import process from 'node:process'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePluginRadar } from 'vite-plugin-radar'
import vueDevTools from 'vite-plugin-vue-devtools'

import { utoolsLocalAssetsPlugin } from './plugins/vite-plugin-utools-local-assets'

type CloudflarePluginFactory = typeof import('@cloudflare/vite-plugin')['cloudflare']

const isNetlify = process.env.SERVER_ENV === `NETLIFY`
const isUTools = process.env.SERVER_ENV === `UTOOLS`
const isCfWorkers = process.env.CF_WORKERS === `1`
const isCfPages = process.env.CF_PAGES === `1`

const base = isNetlify || isCfWorkers || isCfPages ? `/` : isUTools ? `./` : `/md/`

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  let cloudflarePlugin: ReturnType<CloudflarePluginFactory> | null = null
  if (isCfWorkers) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    cloudflarePlugin = cloudflare()
  }

  return {
    base,
    define: { process },
    envPrefix: [`VITE_`, `CF_`],
    plugins: [
      vue(),
      ...(cloudflarePlugin ? [cloudflarePlugin] : []),
      tailwindcss(),
      vueDevTools({
        launchEditor: env.VITE_LAUNCH_EDITOR ?? `code`,
      }),
      !isCfWorkers && nodePolyfills({
        include: [`path`, `util`, `timers`, `stream`, `fs`],
        overrides: {
        // Since `fs` is not supported in browsers, we can use the `memfs` package to polyfill it.
        // fs: 'memfs',
        },
      }),
      VitePluginRadar({
        analytics: { id: `G-7NZL3PZ0NK` },
      }),
      ...(process.env.ANALYZE === `true` ? [visualizer({ emitFile: true, filename: `stats.html` }) as any] : []),
      AutoImport({
        imports: [`vue`, `pinia`, `@vueuse/core`],
        dirs: [`./src/stores`, `./src/utils/toast`, `./src/composables`],
      }),
      Components({
        resolvers: [],
      }),
      isUTools && utoolsLocalAssetsPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, `./src`),
        '@md/web': path.resolve(__dirname, `./src`),
      },
    },
    css: { devSourcemap: true },
    build: {
      rollupOptions: {
        external: [`mermaid`],
        output: {
          chunkFileNames: `static/js/md-[name]-[hash].js`,
          entryFileNames: `static/js/md-[name]-[hash].js`,
          assetFileNames: `static/[ext]/md-[name]-[hash].[ext]`,
          globals: { mermaid: `mermaid` },
          manualChunks(id: string) {
            if (id.includes(`node_modules`)) {
              if (id.includes(`katex`))
                return `katex`
              if (id.includes(`highlight.js`))
                return `hljs`
              if (id.includes(`codemirror`))
                return `codemirror`
              if (id.includes(`prettier`))
                return `prettier`
              const pkg = id
                .split(`node_modules/`)[1]
                .split(`/`)[0]
                .replace(`@`, `npm_`)
              return `vendor_${pkg}`
            }
          },
        },
      },
    },
  }
})
