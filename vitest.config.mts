import { defineConfig } from 'vitest/config';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import path from 'path';

const compiler = reactCompilerPreset();
const alias = { '@': path.resolve(__dirname, './src') };
const reactPlugins = [react(), babel({
  presets: [{
    ...compiler,
    rolldown: {
      ...compiler.rolldown,
      filter: { code: /['"]use client['"]/ },
    },
  }],
})];

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        'src/lib/**/*.d.ts',
        'src/lib/chart-og-image.tsx',
        'src/lib/chart-og-preview.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 58,
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/tests/**/*.test.ts'],
        },
      },
      {
        plugins: reactPlugins,
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/tests/**/*.test.tsx'],
        },
      },
    ],
  },
});
