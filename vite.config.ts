import { defineConfig } from 'vite'

// base './' — относительные пути, чтобы сборка работала и локально,
// и на GitHub Pages под /diogen/ без отдельной настройки.
export default defineConfig({
  base: './',
  server: { host: true },
  build: { target: 'es2020' },
})
