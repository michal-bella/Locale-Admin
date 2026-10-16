export type PageIntroProps = {
	eyebrow: string
	title: string
	description: string
	/** Visual size of the `<h1>`; `h2` (28 px) is the page heading inside the app layout. Defaults to `h1` (32 px). */
	titleSize?: 'h1' | 'h2'
}
