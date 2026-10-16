import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

const apiProxy = { '/api': 'http://localhost:3000' }

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { '@': '/src' },
	},
	server: { port: 5173, strictPort: true, proxy: apiProxy },
	preview: { port: 4173, proxy: apiProxy },
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.{ts,tsx}'],
		setupFiles: ['src/test/setup.ts'],
	},
})
