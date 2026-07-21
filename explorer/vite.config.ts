import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Explorer bundle nạp trực tiếp mã nguồn TS của core qua alias -> không cần build core.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@chain-sim/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
});
