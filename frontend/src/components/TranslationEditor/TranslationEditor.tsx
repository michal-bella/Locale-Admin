import { Loader, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type FocusEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	hasBalancedBraces,
	type PlaceholderMismatchDetails,
	type PluralForm,
	serializePluralValue,
	TRANSLATION_VALUE_MAX_LENGTH,
	updateTranslationRequestSchema,
	VALIDATION_CODE,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import getPlaceholderMismatch from '@/api/getPlaceholderMismatch'
import PluralFormChip from '@/components/PluralForms/PluralFormChip'
import TokenEditor from '@/components/TokenEditor/TokenEditor'
import { parsePluralForms, pluralFormsOf } from '@/lib/pluralForms'

import classes from './TranslationEditor.module.css'
import { type TranslationEditorProps } from './types'

type SaveTrigger = 'blur' | 'keyboard'

type Rejection =
	{ kind: 'mismatch'; details: PlaceholderMismatchDetails } | { kind: 'unbalanced'; forms: PluralForm[] } | { kind: 'tooLong' } | { kind: 'invalid' }

/** `value` is the composed draft that was refused (locally or by the API): a blur with the same draft discards it instead of retrying. */
type Rejected = { value: string | null; rejection: Rejection }

type Draft = Partial<Record<PluralForm, string>>

const PLAIN: PluralForm = 'other'

/**
 * Target cell of the translations table. The read-only value is a button (Enter/Space open the editor natively). Editing is a `TokenEditor`
 * per form (one for a plain key): blur outside the cell and Ctrl/Cmd+Enter save, Esc restores. Empty or whitespace-only text saves `null`;
 * for a plural key the forms are saved as one ICU message (empty forms kept, all empty → `null`) after checking that every form keeps
 * `{`/`}` balanced and the whole message fits `TRANSLATION_VALUE_MAX_LENGTH`. The fields stay open and read-only with a loader while
 * saving, so a `PLACEHOLDER_MISMATCH` or an unparseable plural (`VALIDATION_ERROR` on `value`) can show its message under them; a blur
 * after any of these errors with the same rejected draft discards it.
 */
const TranslationEditor = ({ value, label, plural = null, onSave, children }: TranslationEditorProps) => {
	const { t } = useTranslation()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState<Draft>({})
	const [saving, setSaving] = useState(false)
	const [rejected, setRejected] = useState<Rejected | null>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	const focusButtonRef = useRef(false)
	const hintId = useId()
	const lockedHintId = useId()
	const errorId = useId()

	useEffect(() => {
		if (!editing && focusButtonRef.current) {
			focusButtonRef.current = false
			buttonRef.current?.focus()
		}
	}, [editing])

	const forms: PluralForm[] = plural ? pluralFormsOf(plural.tag, parsePluralForms(value)) : [PLAIN]

	const open = () => {
		setDraft(plural ? parsePluralForms(value) : { [PLAIN]: value ?? '' })
		setRejected(null)
		setEditing(true)
	}

	// Focus returns to the button only when the user is still in a field (Esc, Ctrl+Enter), never after a blur.
	const close = () => {
		focusButtonRef.current = rootRef.current?.contains(document.activeElement) ?? false
		setRejected(null)
		setEditing(false)
	}

	const composeValue = (): string | null => {
		if (!plural) {
			return updateTranslationRequestSchema.parse({ value: draft[PLAIN] ?? '' }).value
		}
		if (forms.every((form) => (draft[form] ?? '').trim() === '')) {
			return null
		}
		return serializePluralValue({ variable: plural.variable, forms: Object.fromEntries(forms.map((form) => [form, draft[form] ?? ''])) })
	}

	const validate = (next: string | null): Rejection | null => {
		if (!plural || next === null) {
			return null
		}
		const unbalanced = forms.filter((form) => !hasBalancedBraces(draft[form] ?? ''))
		if (unbalanced.length > 0) {
			return { kind: 'unbalanced', forms: unbalanced }
		}
		return next.length > TRANSLATION_VALUE_MAX_LENGTH ? { kind: 'tooLong' } : null
	}

	const save = async (trigger: SaveTrigger) => {
		const next = composeValue()
		if (next === value || (rejected?.value === next && trigger === 'blur')) {
			close()
			return
		}
		const rejection = validate(next)
		if (rejection) {
			setRejected({ value: next, rejection })
			return
		}
		setSaving(true)
		try {
			await onSave(next)
			close()
		} catch (error) {
			const details = getPlaceholderMismatch(error)
			if (details) {
				setRejected({ value: next, rejection: { kind: 'mismatch', details } })
			} else if (getApiErrorDetails(error).some((issue) => issue.path === 'value' && issue.code === VALIDATION_CODE.INVALID)) {
				setRejected({ value: next, rejection: { kind: 'invalid' } })
			} else {
				notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) })
				close()
			}
		} finally {
			setSaving(false)
		}
	}

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (saving) {
			return
		}
		if (event.key === 'Escape') {
			event.preventDefault()
			close()
		} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			event.preventDefault()
			void save('keyboard')
		}
	}

	// Moving between the forms of a plural key is not leaving the cell.
	const onBlur = (event: FocusEvent<HTMLDivElement>) => {
		if (!saving && !(event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget))) {
			void save('blur')
		}
	}

	if (!editing) {
		return (
			<button ref={buttonRef} type='button' className={classes.button} onClick={open}>
				<VisuallyHidden>{label}:</VisuallyHidden> {children}
			</button>
		)
	}

	const errorMessage = (rejection: Rejection) => {
		switch (rejection.kind) {
			case 'mismatch':
				return [
					t('errors.PLACEHOLDER_MISMATCH'),
					rejection.details.missing.length > 0 && t('translationsPage.editor.missing', { list: rejection.details.missing.join(', ') }),
					rejection.details.extra.length > 0 && t('translationsPage.editor.extra', { list: rejection.details.extra.join(', ') }),
				]
					.filter(Boolean)
					.join(' ')
			case 'unbalanced':
			case 'invalid':
				return t('translationsPage.editor.unbalancedBraces')
			case 'tooLong':
				return t('translationsPage.editor.tooLong')
		}
	}

	const message = rejected && errorMessage(rejected.rejection)

	const describedBy = [hintId, lockedHintId, message && errorId].filter(Boolean).join(' ')

	const isInvalid = (form: PluralForm) => rejected !== null && (rejected.rejection.kind !== 'unbalanced' || rejected.rejection.forms.includes(form))

	const field = (form: PluralForm, index: number) => (
		<TokenEditor
			key={form}
			value={draft[form] ?? ''}
			onChange={(next) => setDraft((current) => ({ ...current, [form]: next }))}
			label={plural ? t('translationsPage.editor.formLabel', { label, form: t(`translationsPage.plural.forms.${form}`) }) : label}
			pluralHash={plural !== null}
			describedBy={describedBy}
			invalid={isInvalid(form)}
			readOnly={saving}
			maxLength={TRANSLATION_VALUE_MAX_LENGTH}
			focusOnMount={index === 0}
			className={classes.field}
			onKeyDown={onKeyDown}
			onBlur={onBlur}
		/>
	)

	return (
		<div ref={rootRef} className={classes.root}>
			{plural
				? forms.map((form, index) => (
						<div key={form} className={classes.formRow}>
							<PluralFormChip form={form} />
							{field(form, index)}
						</div>
					))
				: field(PLAIN, 0)}
			<div className={classes.footer}>
				<span id={hintId} className={classes.hint}>
					{t('translationsPage.editor.hint')}
				</span>
				<VisuallyHidden id={lockedHintId}>
					{[t('translationsPage.editor.lockedHint'), plural && t('translationsPage.editor.hashHint')].filter(Boolean).join(' ')}
				</VisuallyHidden>
				{/* The live region exists before saving starts, otherwise screen readers may not announce it. */}
				<span role='status' className={classes.saving}>
					{saving && (
						<>
							<Loader size='xs' />
							<VisuallyHidden>{t('translationsPage.editor.saving')}</VisuallyHidden>
						</>
					)}
				</span>
			</div>
			{message && (
				<span id={errorId} role='alert' className={classes.error}>
					{message}
				</span>
			)}
		</div>
	)
}

export default TranslationEditor
