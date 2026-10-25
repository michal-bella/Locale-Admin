// Builds onboarding-editor.pdf from the chapter Markdown files (marked + Playwright Chromium).
// Usage: node docs/onboarding/editor/_tools/build-pdf.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(new URL('../../../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')

const DIR = fileURLToPath(new URL('../', import.meta.url))
const chapters = readdirSync(DIR)
	.filter((f) => /^\d\d-.+\.md$/.test(f))
	.sort()

// The marked CLI cuts long output when it writes to a pipe, so it converts file to file.
function toHtml(markdown) {
	const dir = mkdtempSync(join(tmpdir(), 'onboarding-'))
	writeFileSync(join(dir, 'in.md'), markdown)
	execFileSync('npx', ['--yes', 'marked@4.3.0', '--gfm', '-i', join(dir, 'in.md'), '-o', join(dir, 'out.html')])
	const html = readFileSync(join(dir, 'out.html'), 'utf8')
	rmSync(dir, { recursive: true })
	return html
}
const slug = (text) =>
	text
		.toLowerCase()
		.trim()
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.replace(/\s+/g, '-')

// Screenshots are taken at deviceScaleFactor 2, so half of the PNG width is the size on screen.
const cssWidth = (src) => readFileSync(DIR + src).readUInt32BE(16) / 2
// Wide screenshots span the page; narrower ones (modals, dropdowns) float right so the text wraps around them.
// paginate.js then sizes every figure to the space left on its page.
function figure(src, alt, title) {
	const width = cssWidth(src)
	// The Markdown image title "center" puts a narrower screenshot in the middle with the text below it.
	// "side" keeps a small screenshot floated next to the text at its screen size, so the free space goes to other figures.
	if (title === 'side')
		return `<figure class="side fixed" style="width:${Math.round(Math.min(width * 0.75, 280))}px"><img src="${src}" alt="${alt}"></figure>`
	if (title === 'center') return `<figure class="center" style="width:${Math.round(Math.min(width, 460))}px"><img src="${src}" alt="${alt}"></figure>`
	if (width >= 1000) return `<figure class="wide"><img src="${src}" alt="${alt}"></figure>`
	const height = readFileSync(DIR + src).readUInt32BE(20) / 2
	// A tall, narrow screenshot (a menu column) starts wider so it is not a thin strip next to the text.
	const start = width >= 550 ? 336 : height > width * 2 ? width * 0.9 : width * 0.6
	const style = `width:${Math.round(start)}px`
	return `<figure class="side" style="${style}"><img src="${src}" alt="${alt}"></figure>`
}

const body = chapters
	.map((file) => {
		const markdown = readFileSync(DIR + file, 'utf8').replace(/^---[\s\S]*?---\n/, '')
		const id = file.replace(/\.md$/, '')
		// Cross-chapter links point to the chapter section (or its heading) inside the single PDF document.
		const html = toHtml(markdown)
			.replace(/<p><img src="([^"]+)" alt="([^"]*)"(?: title="([^"]*)")?><\/p>/g, (_, src, alt, title) => figure(src, alt, title))
			// An HTML comment in the Markdown (invisible in Notion) forces a new PDF page.
			.replace(/<!-- pagebreak -->/g, '<div class="pagebreak"></div>')
			// Two images on one Markdown line are a side-by-side pair with their alt text as captions.
			.replace(
				/<p><img src="([^"]+)" alt="([^"]*)">\s*<img src="([^"]+)" alt="([^"]*)"><\/p>/g,
				(_, a, altA, b, altB) =>
					`<div class="pair">${[
						[a, altA],
						[b, altB],
					]
						.map(([src, alt]) => `<figure><img src="${src}" alt="${alt}"><figcaption>${alt}</figcaption></figure>`)
						.join('')}</div>`,
			)
			.replace(/href="\.\/(\d\d-[^"#]+)\.md#([^"]+)"/g, 'href="#$2"')
			.replace(/href="\.\/(\d\d-[^"#]+)\.md"/g, 'href="#$1"')
			.replace(/<h([1-3])>(.*?)<\/h\1>/g, (_, level, text) => `<h${level} id="${slug(text.replace(/<[^>]+>/g, ''))}">${text}</h${level}>`)
		return `<section class="chapter" id="${id}">${html}</section>`
	})
	.join('\n')

const toc = chapters
	.map((file) => {
		const title = readFileSync(DIR + file, 'utf8').match(/^# (.+)$/m)[1]
		return `<li><a href="#${file.replace(/\.md$/, '')}">${title}</a></li>`
	})
	.join('')

const today = new Date().toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })
const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><base href="${pathToFileURL(DIR)}">
<style>
	@page { size: A4; margin: 18mm 16mm 20mm; }
	body { margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1e293b; }
	.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
	.cover .eyebrow { color: #db2777; font-weight: 700; letter-spacing: .14em; font-size: 10pt; text-transform: uppercase; }
	.cover h1 { font-size: 34pt; margin: 8px 0 12px; border: 0; }
	.cover p { color: #64748b; font-size: 13pt; margin: 0; }
	.cover .meta { margin-top: 40px; font-size: 10pt; }
	.toc { page-break-after: always; }
	.toc ol { font-size: 12pt; line-height: 2.1; }
	.page { height: 970px; overflow: hidden; break-after: page; }
	.page:last-child { break-after: auto; }
	.content { display: flow-root; }
	h1 { font-size: 22pt; color: #0f172a; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 3px solid #ec4899; }
	h2 { font-size: 14.5pt; color: #0f172a; margin: 18px 0 8px; page-break-after: avoid; }
	h3 { font-size: 12pt; color: #334155; margin: 16px 0 6px; page-break-after: avoid; }
	a { color: #be185d; text-decoration: none; }
	code { font-family: 'SF Mono', Menlo, monospace; font-size: 9pt; background: #fdf2f8; color: #9d174d; padding: 1px 4px; border-radius: 4px; }
	pre { background: #f1f5f9; padding: 10px; border-radius: 6px; }
	pre code { background: none; color: inherit; }
	figure { margin: 0; page-break-inside: avoid; }
	figure img { display: block; width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 4px rgba(15, 23, 42, .08); }
	figure.wide { margin: 8px 0 12px; }
	figure.wide { margin-left: auto; margin-right: auto; }
	figure.wide img, figure.center img { width: 100%; }
	figure.side { float: right; margin: 4px 0 10px 16px; }
	.pair { display: flex; gap: 16px; margin: 8px 0 12px; page-break-inside: avoid; }
	.pair figure { flex: 1; }
	.pair figcaption { margin-top: 6px; font-size: 9pt; color: #64748b; text-align: center; }
	figure.center { float: none; margin: 8px auto 12px; }
	h2 { clear: both; }
	table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 9.5pt; page-break-inside: avoid; }
	th, td { text-align: left; border-bottom: 1px solid #e2e8f0; padding: 5px 8px; vertical-align: top; }
	th { background: #f8fafc; color: #475569; }
	blockquote { margin: 12px 0; padding: 8px 14px; background: #fdf2f8; border-left: 3px solid #ec4899; color: #475569; }
	li { margin: 2px 0; }
</style></head><body>
<div class="cover">
	<div class="eyebrow">Locale Admin</div>
	<h1>Onboarding pre editorov</h1>
	<p>Ako prekladať texty aplikácií v Locale Admin</p>
	<div class="meta">Koncept · ${today}</div>
</div>
<div class="toc"><h1>Obsah</h1><ol>${toc}</ol></div>
${body}
</body></html>`

const htmlPath = `${DIR}_tools/onboarding-editor.html`
writeFileSync(htmlPath, html)
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 673, height: 1000 })
await page.emulateMedia({ media: 'print' })
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' })
await page.addScriptTag({ path: fileURLToPath(new URL('./paginate.js', import.meta.url)) })
if (process.env.DEBUG_PAGES)
	console.log(
		await page.evaluate(() =>
			[...document.querySelectorAll('.page')]
				.map(
					(p, i) =>
						`${i + 3}: ${p.firstElementChild.scrollHeight} ${[...p.firstElementChild.children].map((c) => c.tagName + (c.tagName === 'P' ? ':' + c.textContent.slice(0, 20) : '')).join(' | ')}`,
				)
				.join('\n'),
		),
	)
await page.pdf({
	path: `${DIR}onboarding-editor.pdf`,
	format: 'A4',
	printBackground: true,
	displayHeaderFooter: true,
	headerTemplate: '<span></span>',
	footerTemplate:
		'<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 16mm;display:flex;justify-content:space-between"><span>Locale Admin · Onboarding pre editorov</span><span class="pageNumber"></span></div>',
	margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
})
await browser.close()
console.log('PDF:', `${DIR}onboarding-editor.pdf`)
