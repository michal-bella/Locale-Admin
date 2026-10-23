import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

// 127.0.0.1, not localhost: the dev backend listens on IPv4 only, and Node resolves localhost to ::1 first, where another app may hold the
// port. The target can be moved when port 4000 is taken by another checkout's backend (local verification only).
const apiProxy = { '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:4000' }

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { '@': '/src' },
	},
	server: { port: 5173, strictPort: true, proxy: apiProxy },
	preview: { port: 4173, proxy: apiProxy },
	build: {
		rolldownOptions: {
			output: {
				// Vendor chunks change only on dependency upgrades, so browsers keep them cached across app releases.
				codeSplitting: {
					groups: [
						{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
						// Charts (with recharts) are used only by the lazy Prehľad page and must not land in the eager Mantine chunk.
						{ name: 'mantine', test: /node_modules[\\/]@mantine[\\/](?!charts[\\/])/, priority: 30 },
						{ name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/, priority: 20 },
						{ name: 'i18n-zod', test: /node_modules[\\/](i18next|react-i18next|zod)[\\/]/, priority: 10 },
					],
				},
			},
		},
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.{ts,tsx}'],
		setupFiles: ['src/test/setup.ts'],
	},
})
