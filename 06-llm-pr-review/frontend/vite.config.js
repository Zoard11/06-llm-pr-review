import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import rollupNodePolyFill from 'rollup-plugin-polyfill-node'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    rollupNodePolyFill()
  ],
})
