import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

function hostManifestPlugin() {
  return {
    name: `host-manifest`,
    generateBundle(_: any, bundle: any) {
      let bridge = ``
      const styles = new Set<string>()
      const assets = new Set<string>()

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === `chunk`) {
          if (chunk.name === `md-host-bridge`) {
            bridge = fileName
            if (chunk.viteMetadata) {
              for (const cssFile of chunk.viteMetadata.importedCss ?? []) {
                styles.add(cssFile)
              }
              for (const assetFile of chunk.viteMetadata.importedAssets ?? []) {
                assets.add(assetFile)
              }
            }
          }
        }
        else if (chunk.type === `asset`) {
          if (fileName.endsWith(`.css`)) {
            styles.add(fileName)
          }
          else if (!fileName.endsWith(`.map`)) {
            assets.add(fileName)
          }
        }
      }

      const manifest = {
        bridge,
        styles: Array.from(styles),
        assets: Array.from(assets),
      }

      this.emitFile({
        type: `asset`,
        fileName: `manifest-host.json`,
        source: JSON.stringify(manifest, null, 2),
      })
    },
  }
}

export default defineConfig({
  base: `./`,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, `./src`),
      '@md/web': path.resolve(__dirname, `./src`),
      '@md/shared': path.resolve(__dirname, `../..`, `packages/shared/src`),
      '@md/core': path.resolve(__dirname, `../..`, `packages/core/src`),
    },
  },
  plugins: [
    vue(),
    tailwindcss(),
    nodePolyfills({
      include: [`path`, `util`, `timers`, `stream`, `fs`],
    }),
    AutoImport({
      imports: [`vue`, `pinia`, `@vueuse/core`],
      dirs: [`./src/stores`, `./src/utils/toast`, `./src/composables`],
    }),
    Components({
      resolvers: [],
    }),
    hostManifestPlugin(),
  ],
  build: {
    emptyOutDir: false,
    outDir: path.resolve(__dirname, `dist/host`),
    lib: {
      entry: path.resolve(__dirname, `src/host/entry.ts`),
      name: `AYQYMDBridge`,
      fileName: () => `md-host-bridge`,
      formats: [`iife`],
    },
    rollupOptions: {
      output: {
        assetFileNames: `static/[ext]/[name]-[hash].[ext]`,
      },
    },
  },
})
