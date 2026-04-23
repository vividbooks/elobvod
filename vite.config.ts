import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Pro vlastní doménu / subdomain (GitHub Pages u kořene) musí být base „/“.
// Jen project page bez vlastní domény: https://USER.github.io/REPO/ → build s --base /REPO/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/' : '/',
  server: {
    // Spolehlivější než „localhost“ na některých Macích (IPv4 vs IPv6).
    host: '127.0.0.1',
    port: 5173,
    // Když je 5173 obsazené, neskákat tiše na 5174 – ať URL v terminálu sedí.
    strictPort: true,
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
}))
