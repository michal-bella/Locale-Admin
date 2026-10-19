import classes from './TranslationText.module.css'
import { type TranslationTextProps } from './types'

/** The capturing group keeps the placeholders in `split`, at the odd indexes. */
const PLACEHOLDER_PATTERN = /(\{\{[^{}]+\}\})/

/**
 * A translation value with `{{var}}` (also `{{ var }}`) as chips (Figma 3:177). Everything else, HTML included, is plain text:
 * React escapes it, so `<strong>` shows up as typed and never renders.
 */
const TranslationText = ({ value }: TranslationTextProps) => (
	<span className={classes.text}>
		{value.split(PLACEHOLDER_PATTERN).map((part, index) =>
			index % 2 === 1 ? (
				<code key={index} className={classes.chip}>
					{part}
				</code>
			) : (
				part
			),
		)}
	</span>
)

export default TranslationText
