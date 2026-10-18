export type PageIntroProps = {
	eyebrow: string
	/** Shows the eyebrow as a tinted badge, e.g. the project name above Preklady (Figma 3:35). */
	eyebrowBadge?: boolean
	title: string
	description: string
	/** Visual size of the `<h1>`; `h2` (28 px) is the page heading inside the app layout. Defaults to `h1` (32 px). */
	titleSize?: 'h1' | 'h2'
}
