import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: { server: 'src/server.ts', seed: 'prisma/seed.ts' },
	format: 'esm',
	platform: 'node',
	outDir: 'dist',
	dts: false,
	fixedExtension: false,
	// @locale/shared ships TypeScript sources, so it has to be bundled; real npm deps stay external.
	deps: { alwaysBundle: ['@locale/shared'] },
})
