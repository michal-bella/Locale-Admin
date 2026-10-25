// Runs inside the PDF page: flows every chapter into fixed-height A4 pages and sizes the screenshots to the space
// that is left on each page, so a figure that does not fit does not leave half a page empty.
;(() => {
	const PAGE_HEIGHT = 970 // printable A4 height (297 − 18 − 20 mm) with a small reserve for rounding
	const PAGE_WIDTH = 673 // printable A4 width (210 − 2 × 16 mm)
	const WIDE_MAX_HEIGHT = 340
	const SIDE_MAX_WIDTH = PAGE_WIDTH * 0.6
	const CENTER_MAX_WIDTH = PAGE_WIDTH * 0.92
	const MIN_SHRINK = 0.7
	// Screenshots are taken at 2× pixel density, so up to ~1.7× their screen size they stay sharp in the PDF.
	const MAX_GROWTH = 1.7

	const paged = document.createElement('div')
	paged.className = 'paged'
	let content

	const fits = () => content.scrollHeight <= PAGE_HEIGHT
	const width = (figure) => figure.getBoundingClientRect().width
	const setWidth = (figure, value) => (figure.style.width = `${Math.round(value)}px`)
	const isHeading = (el) => el && /^H[1-4]$/.test(el.tagName)
	const isIntro = (el) => el && el.tagName === 'P' && el.textContent.trim().endsWith(':')

	function newPage() {
		const page = document.createElement('div')
		page.className = 'page'
		content = document.createElement('div')
		content.className = 'content'
		page.append(content)
		paged.append(page)
	}

	// Shrinks the figure step by step until the page fits, never below `min` of its current width.
	function shrink(figure, min = MIN_SHRINK) {
		const start = width(figure)
		for (let factor = 0.95; factor >= min; factor -= 0.05) {
			setWidth(figure, start * factor)
			if (fits()) return true
		}
		setWidth(figure, start)
		return false
	}

	// Height of text that sits next to a floated figure.
	function textBeside(figure) {
		const box = figure.getBoundingClientRect()
		let beside = 0
		for (const sibling of content.children) {
			if (sibling === figure || sibling.tagName === 'FIGURE') continue
			const rect = sibling.getBoundingClientRect()
			beside += Math.max(0, Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top))
		}
		return beside
	}

	function finishPage() {
		// A float with little text next to it leaves an empty column, so it moves to the middle and gets bigger.
		for (const figure of content.querySelectorAll('figure.side:not(.fixed)')) {
			const box = figure.getBoundingClientRect()
			if (textBeside(figure) >= box.height * 0.4) continue
			const original = box.width
			figure.classList.replace('side', 'center')
			setWidth(figure, Math.min(original * 1.45, CENTER_MAX_WIDTH, (figure.querySelector('img').naturalWidth / 2) * MAX_GROWTH))
			if (!fits() && !shrink(figure, original / width(figure))) {
				figure.classList.replace('center', 'side')
				setWidth(figure, original)
			}
		}
		// A centered figure next to a float would hit it when it grows and jump below it, so it keeps to the left edge.
		for (const figure of content.querySelectorAll(':scope > figure.center')) {
			const box = figure.getBoundingClientRect()
			const besideFloat = [...content.querySelectorAll(':scope > figure.side')].some((side) => {
				const rect = side.getBoundingClientRect()
				return rect.top < box.bottom && rect.bottom > box.top
			})
			if (besideFloat) figure.style.marginLeft = '0'
		}
		// Empty space at the bottom goes to the figures on the page, the smallest one first.
		const figures = [...content.querySelectorAll(':scope > figure:not(.fixed)')].sort((a, b) => width(a) - width(b))
		for (const figure of figures) {
			const layoutMax = figure.classList.contains('side') ? SIDE_MAX_WIDTH : figure.classList.contains('center') ? CENTER_MAX_WIDTH : PAGE_WIDTH
			// Small screenshots (a dropdown, a menu) would look blown up beyond MAX_GROWTH × their screen size.
			const max = Math.min(layoutMax, (figure.querySelector('img').naturalWidth / 2) * MAX_GROWTH)
			while (width(figure) < max - 1) {
				const before = width(figure)
				setWidth(figure, Math.min(before * 1.04, max))
				// Stop when the page overflows, or when the width cannot change (a figure inside a flex row).
				if (!fits() || width(figure) <= before) {
					setWidth(figure, before)
					break
				}
			}
		}
	}

	// Moves the block (with a heading or a "…:" sentence right before it) to a new page.
	function moveToNewPage(block) {
		const carry = [block]
		block.remove()
		while (isHeading(content.lastElementChild) || isIntro(content.lastElementChild)) {
			const prev = content.lastElementChild
			// Never empty the page completely, a heading alone on top of a chapter stays.
			if (content.children.length === 1) break
			prev.remove()
			carry.unshift(prev)
		}
		finishPage()
		newPage()
		content.append(...carry)
		if (!fits() && block.tagName === 'FIGURE') shrink(block, 0.3)
	}

	function splitList(list) {
		const rest = list.cloneNode(false)
		while (!fits() && list.children.length > 1) rest.prepend(list.lastElementChild)
		// Not even the first item fits, or only one item would stay behind: move the whole list.
		if (!fits() || (list.children.length === 1 && rest.children.length > 1)) {
			list.append(...rest.children)
			moveToNewPage(list)
			return
		}
		if (list.tagName === 'OL') rest.start = (list.start || 1) + list.children.length
		finishPage()
		newPage()
		content.append(rest)
		if (!fits()) splitList(rest)
	}

	function place(block) {
		if (block.classList.contains('pagebreak')) {
			if (content.children.length) {
				finishPage()
				newPage()
			}
			return
		}
		content.append(block)
		if (fits()) return
		if (block.tagName === 'FIGURE' && shrink(block)) return
		if ((block.tagName === 'UL' || block.tagName === 'OL') && block.children.length > 1) return splitList(block)
		moveToNewPage(block)
	}

	const sections = [...document.querySelectorAll('section.chapter')]
	document.body.append(paged)
	for (const section of sections) {
		for (const figure of section.querySelectorAll('figure.wide')) {
			const img = figure.querySelector('img')
			setWidth(figure, Math.min(PAGE_WIDTH, (WIDE_MAX_HEIGHT * img.naturalWidth) / img.naturalHeight))
		}
		newPage()
		// Links to a chapter (table of contents, cross references) point at the section id, which goes away with the section.
		content.parentElement.id = section.id
		for (const block of [...section.children]) place(block)
		finishPage()
		section.remove()
	}
})()
