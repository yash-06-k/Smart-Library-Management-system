import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Optimize build size and performance
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': ['firebase'],
          'charts': ['chart.js', 'react-chartjs-2'],
          'utils': ['axios', 'clsx', 'framer-motion'],
        },
      },
    },
    // Target modern browsers for better performance
    target: 'es2015',
    // Source maps for production debugging
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'firebase', 'axios'],
  },
})
