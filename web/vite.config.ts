import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Stamped at build time; busts the engine-worker + data caches per deploy.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
})
