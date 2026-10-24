import { Tooltip } from '@mantine/core'
import { type ClipboardEvent, type KeyboardEvent, type MouseEvent, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import textClasses from '@/components/TranslationText/TranslationText.module.css'
import { isUnknownPlaceholder } from '@/components/TranslationText/isUnknownPlaceholder'

import classes from './TokenEditor.module.css'
import { type ChipClassNames, type ChipDecoration, type ChipTitles, render, selectionOffsets, serialize, setCaret } from './editorDom'
import { type Token, tokenize, tokenRanges } from './tokens'
import { type TokenEditorProps } from './types'

const CHIP_CLASS_NAMES: ChipClassNames = { placeholder: textClasses.chip, hash: textClasses.chip, tag: classes.tag }

/**
 * Plain-text editor (`contenteditable`) where `{{var}}` placeholders and HTML tags are atomic chips: the caret never enters them,
 * Backspace/Delete removes a whole chip, paste inserts plain text and Enter a newline. The DOM is rebuilt from the value after every
 * edit (caret restored by offset), so browser-made markup never survives and the value serializes back to the exact string.
 */
const TokenEditor = ({
	value,
	onChange,
	label,
	pluralHash = false,
	basePlaceholders,
	describedBy,
	invalid = false,
	readOnly = false,
	maxLength,
	modalAutofocus = false,
	onKeyDown,
	onBlur,
	className,
	minRows,
	ref,
}: TokenEditorProps) => {
	const { t } = useTranslation()
	const rootRef = useRef<HTMLDivElement>(null)
	const renderedRef = useRef<string | null>(null)
	const composingRef = useRef(false)
	const autofocusedRef = useRef(false)

	useImperativeHandle(ref, () => rootRef.current as HTMLDivElement)

	const tokens = (text: string) => tokenize(text, { tags: true, hash: pluralHash })
	const chipTitles: ChipTitles = { hash: t('translationsPage.plural.hash') }
	const decorate = (token: Token): ChipDecoration | undefined =>
		token.type === 'placeholder' && isUnknownPlaceholder(token.value, basePlaceholders) ? { className: textClasses.chipWarning ?? '' } : undefined
	// A native title never shows inside contenteditable, so a Tooltip sits on an anchor laid over the hovered warning chip.
	const [warningRect, setWarningRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
	const trackWarningChip = (event: MouseEvent<HTMLDivElement>) => {
		const chip = event.target instanceof Element ? event.target.closest(`.${textClasses.chipWarning}`) : null
		if (!chip || !rootRef.current) {
			setWarningRect(null)
			return
		}
		const outer = rootRef.current.parentElement?.getBoundingClientRect()
		const rect = chip.getBoundingClientRect()
		setWarningRect({ left: rect.left - (outer?.left ?? 0), top: rect.top - (outer?.top ?? 0), width: rect.width, height: rect.height })
	}

	const commit = (next: string, caret: number) => {
		const root = rootRef.current
		if (!root) {
			return
		}
		render(root, tokens(next), CHIP_CLASS_NAMES, chipTitles, decorate)
		renderedRef.current = next
		setCaret(root, Math.min(caret, next.length))
		onChange(next)
	}

	useLayoutEffect(() => {
		const root = rootRef.current
		if (root && renderedRef.current !== value) {
			render(root, tokens(value), CHIP_CLASS_NAMES, chipTitles, decorate)
			renderedRef.current = value
			if (root.ownerDocument.activeElement === root) {
				setCaret(root, value.length)
			}
		}
	})

	const current = () => renderedRef.current ?? value

	const clip = (text: string, start: number, end: number) => {
		const room = maxLength === undefined ? text.length : Math.max(0, maxLength - (current().length - (end - start)))
		return text.slice(0, room)
	}

	const replaceSelection = (text: string) => {
		const root = rootRef.current
		const selection = root && selectionOffsets(root)
		if (!selection) {
			return
		}
		const [start, end] = selection
		const inserted = clip(text, start, end)
		commit(current().slice(0, start) + inserted + current().slice(end), start + inserted.length)
	}

	const handleInput = () => {
		const root = rootRef.current
		if (!root || composingRef.current) {
			return
		}
		const caret = selectionOffsets(root)?.[0] ?? 0
		let next = serialize(root)
		if (maxLength !== undefined && next.length > maxLength) {
			next = next.slice(0, maxLength)
		}
		commit(next, caret)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event)
		if (event.defaultPrevented || readOnly || composingRef.current) {
			return
		}
		const root = rootRef.current
		const selection = root && selectionOffsets(root)
		if (event.key === 'Enter') {
			event.preventDefault()
			if (!event.ctrlKey && !event.metaKey) {
				replaceSelection('\n')
			}
			return
		}
		if (!selection) {
			return
		}
		const [start, end] = selection
		if (event.key === 'Backspace' && start === end) {
			const chip = tokenRanges(tokens(current())).find((range) => range.end === start)
			if (chip) {
				event.preventDefault()
				commit(current().slice(0, chip.start) + current().slice(chip.end), chip.start)
			}
			return
		}
		if (event.key === 'Delete' && start === end) {
			const chip = tokenRanges(tokens(current())).find((range) => range.start === start)
			if (chip) {
				event.preventDefault()
				commit(current().slice(0, chip.start) + current().slice(chip.end), chip.start)
			}
			return
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && maxLength !== undefined && start === end && current().length >= maxLength) {
			event.preventDefault()
		}
	}

	const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault()
		if (!readOnly) {
			replaceSelection(event.clipboardData.getData('text/plain'))
		}
	}

	return (
		<div className={`${classes.wrapper} ${className ?? ''}`}>
			<div
				ref={rootRef}
				role='textbox'
				aria-multiline
				aria-label={label}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				aria-readonly={readOnly || undefined}
				contentEditable={readOnly ? false : 'plaintext-only'}
				tabIndex={0}
				spellCheck={false}
				data-maxlength={maxLength}
				data-autofocus={modalAutofocus || undefined}
				onFocus={() => {
					if (modalAutofocus && !autofocusedRef.current && rootRef.current) {
						autofocusedRef.current = true
						setCaret(rootRef.current, current().length)
					}
				}}
				className={classes.root}
				// `lh` is the field's own line height; the padding and border come on top, as in the one-line `min-height`.
				style={minRows === undefined ? undefined : { minHeight: `calc(${minRows}lh + 1rem + 2px)` }}
				onMouseOver={trackWarningChip}
				onMouseLeave={() => setWarningRect(null)}
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				onPaste={handlePaste}
				onDrop={(event) => event.preventDefault()}
				onCompositionStart={() => {
					composingRef.current = true
				}}
				onCompositionEnd={() => {
					composingRef.current = false
					handleInput()
				}}
				onBlur={onBlur}
			/>
			{warningRect && (
				<Tooltip opened label={t('translationsPage.editor.unknownVariable')} multiline w={260}>
					<span aria-hidden className={classes.warningAnchor} style={warningRect} />
				</Tooltip>
			)}
		</div>
	)
}

export default TokenEditor
