import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import {isDev, r, port} from './scripts/utils';

export const sharedConfig: UserConfig = {
  root: r('src'),
  resolve: {
    // alias: {
    //   '~/': `${r('src')}/`,
    // },
  },
  define: {
    __DEV__: isDev,
  },
  plugins: [
    AutoImport({
      imports: [
        {
          'webextension-polyfill': [
            ['*', 'browser'],
          ],
        },
      ],
      dts: r('src/auto-imports.d.ts'),
    }),

    // rewrite assets to use relative path
    // {
    //   name: 'assets-rewrite',
    //   enforce: 'post',
    //   apply: 'build',
    //   transformIndexHtml(html, { path }) {
    //     return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`)
    //   },
    // },
  ],
  optimizeDeps: {
    include: [
      'webextension-polyfill',
    ],
  },
}

export default defineConfig(({ command }) => ({
  ...sharedConfig,
  base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
  },
  build: {
    reportCompressedSize: !isDev,
    minify: !isDev,
    cssCodeSplit: false,
    watch: isDev ? {} : undefined,
    outDir: r('extension/dist'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
    // terserOptions: {
    //   compress: !isDev,
    //   mangle: false,
    // },
    rollupOptions: {
      input: {
        background: r('src/background.html'),
        options: r('src/options.html'),
        popup: r('src/popup.html'),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      },
      external: "webextension-polyfill",
    },
  },
  plugins: [
    ...sharedConfig.plugins!,
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
}))
