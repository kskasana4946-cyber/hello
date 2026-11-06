import { defineConfig } from 'vitest/config';
import { glslShaderPlugin } from './vite.config';

export default defineConfig({
  plugins: [glslShaderPlugin()],
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
  },
});
