import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import wyw from '@wyw-in-js/vite'

const sharedAlias = {
  '@shared': resolve(__dirname, 'src/shared')
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        ...sharedAlias
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: 'es'
        },
        external: ['sharp', 'better-sqlite3']
      },
      sourcemap: true
    }
  },
  preload: {
    resolve: {
      alias: {
        ...sharedAlias
      }
    },
    build: {
      rollupOptions: {
        output: {
          format: 'es'
        }
      }
    }
  },
  renderer: {
    server: {
      port: 5173,
      strictPort: true
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src', 'renderer', 'src'),
        ...sharedAlias
      }
    },
    plugins: [
      react(),
      wyw({
        babelOptions: {
          presets: ['@babel/preset-typescript', '@babel/preset-react']
        }
      })
    ],
    build: {
      rollupOptions: {
        // output: {
        //   preserveModules: true,
        //   format: 'es',
        //   preserveModulesRoot: resolve('src/renderer'),
        //   entryFileNames: `[name].js`,
        //   chunkFileNames: `chunks/[name].js`,
        //   assetFileNames: `[name][extname]`
        // },
        // preserveEntrySignatures: 'strict'
      },
      sourcemap: true
    }
  }
})
