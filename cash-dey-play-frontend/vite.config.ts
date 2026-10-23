import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');

  // A production build without a real ad unit would silently ship a fake 5-second "ad" that earns nothing
  // and still rewards the player. Fail the build instead. Staging may opt in with VITE_ALLOW_MOCK_ADS=true.
  if (mode === 'production') {
    const blockId = (env.VITE_ADSGRAM_BLOCK_ID ?? '').trim();
    const hasRealAdUnit = blockId !== '' && blockId !== 'mock';
    if (!hasRealAdUnit && env.VITE_ALLOW_MOCK_ADS !== 'true') {
      throw new Error(
        'VITE_ADSGRAM_BLOCK_ID is missing or "mock". Set the real Adsgram block ID, or set VITE_ALLOW_MOCK_ADS=true for a staging build.'
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
