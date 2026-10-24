import { Button, Tooltip, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	comparePlaceholders,
	hasBalancedBraces,
	type Language,
	type PlaceholderMismatchDetails,
	type PluralForm,
	serializePluralValue,
	TRANSLATION_VALUE_MAX_LENGTH,
	type TranslationListItem,
	updateTranslationRequestSchema,
	VALIDATION_CODE,
	placeholderReference,
	placeholders,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import getPlaceholderMismatch from '@/api/getPlaceholderMismatch'
import AppModal from '@/components/AppModal/AppModal'
import appModalClasses from '@/components/AppModal/AppModal.module.css'
import { Copy, Info } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import PlaceholderWarning from '@/components/PlaceholderWarning/PlaceholderWarning'
import PluralFormChip from '@/components/PluralForms/PluralFormChip'
import RowAction from '@/components/RowAction/RowAction'
import TokenEditor from '@/components/TokenEditor/TokenEditor'
import TranslationValue from '@/components/TranslationValue/TranslationValue'
import { formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { parsePluralForms, pluralFormsOf } from '@/lib/pluralForms'

import classes from './EditTranslationModal.module.css'
import { type EditTranslationModalProps } from './types'

type Rejection =
	{ kind: 'mismatch'; details: PlaceholderMismatchDetails } | { kind: 'unbalanced'; forms: PluralForm[] } | { kind: 'tooLong' } | { kind: 'invalid' }

type Draft = Partial<Record<PluralForm, string>>

const PLAIN: PluralForm = 'other'

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const SHORTCUT = IS_MAC ? '⌘ Enter' : 'Ctrl + Enter'

// The icon is not focusable; its accessible name carries the same text, and touch opens the tooltip.
const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/**
 * "Upraviť preklad": the key, the language, the base language value as a reference and a `TokenEditor` per form (one for a plain key).
 * Saves only with the button. Empty or whitespace-only text saves `null`; for a plural key the forms are saved as one ICU message (empty
 * forms kept, all empty → `null`) after checking that every form keeps `{`/`}` balanced and the whole message fits
 * `TRANSLATION_VALUE_MAX_LENGTH`. `PLACEHOLDER_MISMATCH` and an unparseable plural (`VALIDATION_ERROR` on `value`) show under the
 * fields and keep the modal open; any other error shows a notification. `key` on the content resets the draft for every key and language.
 * The footer shows who saved the value last and when. With `onNext`, Uložiť a ďalší (and Cmd/Ctrl+Enter) saves and moves to the next
 * untranslated cell instead of closing. Both save buttons and the shortcut wait for a change in the field.
 */
const EditTranslationModal = ({ item, language, baseLanguage, opened, onClose, onSave, onNext, focusOnSwitch = false }: EditTranslationModalProps) => {
	const { t } = useTranslation()
	const [saving, setSaving] = useState(false)

	return (
		<AppModal
			opened={opened}
			onClose={onClose}
			title={t('translationsPage.editModal.title')}
			closeLabel={t('translationsPage.editModal.close')}
			isPending={saving}
		>
			{item && language && (
				<Fields
					key={`${item.keyId}:${language.id}`}
					item={item}
					language={language}
					baseLanguage={baseLanguage}
					saving={saving}
					setSaving={setSaving}
					onClose={onClose}
					onSave={onSave}
					onNext={onNext}
					focusOnMount={focusOnSwitch}
				/>
			)}
		</AppModal>
	)
}

type FieldsProps = Pick<EditTranslationModalProps, 'baseLanguage' | 'onClose' | 'onSave' | 'onNext'> & {
	item: TranslationListItem
	language: Language
	saving: boolean
	setSaving: (saving: boolean) => void
	focusOnMount: boolean
}

const Fields = ({ item, language, baseLanguage, saving, setSaving, onClose, onSave, onNext, focusOnMount }: FieldsProps) => {
	const { t, i18n } = useTranslation()
	const cell = item.translations[language.id]
	const value = cell?.value ?? null
	const plural = item.plural ? { variable: item.plural.variable, tag: language.tag } : null
	const forms: PluralForm[] = plural ? pluralFormsOf(plural.tag, parsePluralForms(value)) : [PLAIN]
	const [initialDraft] = useState<Draft>(() => (plural ? parsePluralForms(value) : { [PLAIN]: value ?? '' }))
	const [draft, setDraft] = useState<Draft>(initialDraft)
	const isPristine = forms.every((form) => (draft[form] ?? '') === (initialDraft[form] ?? ''))
	const [rejected, setRejected] = useState<Rejection | null>(null)
	const editorRefs = useRef<Partial<Record<PluralForm, HTMLDivElement | null>>>({})
	const pendingFocusRef = useRef(focusOnMount)
	const label = t('translationsPage.editor.label', { key: item.name, language: t(`languageNames.${language.tag}`) })
	const lockedHintId = useId()
	const errorId = useId()
	const baseValue = baseLanguage && baseLanguage.id !== language.id ? (item.translations[baseLanguage.id]?.value ?? null) : undefined
	const reference = baseLanguage
		? (placeholderReference(
				{ name: item.name, plural: item.plural !== null },
				item.translations[baseLanguage.id]?.value ?? null,
				baseLanguage.id === language.id,
			) ?? undefined)
		: undefined
	const basePlaceholders = reference === undefined ? undefined : placeholders(reference)
	const draftValue = plural
		? serializePluralValue({ variable: plural.variable, forms: Object.fromEntries(forms.map((form) => [form, draft[form] ?? ''])) })
		: (draft[PLAIN] ?? '')
	// An empty draft is untranslated, not a mismatch; the cell shows no warning for it either.
	const draftEmpty = forms.every((form) => (draft[form] ?? '').trim() === '')
	const draftMismatch = reference === undefined || draftEmpty ? null : comparePlaceholders(reference, draftValue)

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

	// Uložiť is disabled while it loads, so without this the focus would end on the body after a rejected save.
	const reject = (rejection: Rejection) => {
		setRejected(rejection)
		const form = rejection.kind === 'unbalanced' ? rejection.forms[0] : forms[0]
		if (form) {
			editorRefs.current[form]?.focus()
		}
	}

	const save = async (goNext = false) => {
		if (saving) {
			return
		}
		const done = goNext && onNext ? onNext : onClose
		const next = composeValue()
		if (next === value) {
			done()
			return
		}
		const rejection = validate(next)
		if (rejection) {
			reject(rejection)
			return
		}
		setSaving(true)
		try {
			await onSave(item.keyId, language.id, next)
			done()
		} catch (error) {
			const details = getPlaceholderMismatch(error)
			if (details) {
				reject({ kind: 'mismatch', details })
			} else if (getApiErrorDetails(error).some((issue) => issue.path === 'value' && issue.code === VALIDATION_CODE.INVALID)) {
				reject({ kind: 'invalid' })
			} else {
				notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) })
			}
		} finally {
			setSaving(false)
		}
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

	const message = rejected && errorMessage(rejected)
	const describedBy = [lockedHintId, message && errorId].filter(Boolean).join(' ')
	const isInvalid = (form: PluralForm) => rejected !== null && (rejected.kind !== 'unbalanced' || rejected.forms.includes(form))

	// Copies the format of the base text (variables, HTML, plural forms) as a starting point; a target form the base lacks takes its Other form.
	const copyBase = (base: string) => {
		const baseForms = parsePluralForms(base)
		setDraft(plural ? Object.fromEntries(forms.map((form) => [form, baseForms[form] ?? baseForms.other ?? ''])) : { [PLAIN]: base })
		setRejected(null)
		editorRefs.current[forms[0] ?? PLAIN]?.focus()
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault()
			// The shortcut of the save buttons, so it does nothing while they are disabled.
			if (!isPristine) {
				void save(true)
			}
		}
	}

	const lastEditText =
		cell?.updatedAt &&
		(cell.updatedBy
			? t('translationsPage.editModal.lastEdit', { name: cell.updatedBy.name, time: formatRelativeTime(cell.updatedAt, i18n.language) })
			: t('translationsPage.editModal.lastEditTime', { time: formatRelativeTime(cell.updatedAt, i18n.language) }))
	const lastEdit = cell?.updatedAt && lastEditText && (
		<Tooltip
			label={
				<>
					<div>{lastEditText}</div>
					<div>{formatDateTime(cell.updatedAt, i18n.language)}</div>
				</>
			}
			events={TOOLTIP_EVENTS}
		>
			<span className={classes.lastEdit} role='img' aria-label={lastEditText}>
				<Info aria-hidden />
			</span>
		</Tooltip>
	)

	const field = (form: PluralForm, index: number) => (
		<TokenEditor
			key={form}
			ref={(element) => {
				if (element && index === 0 && pendingFocusRef.current) {
					pendingFocusRef.current = false
					element.focus()
				}
				editorRefs.current[form] = element
			}}
			value={draft[form] ?? ''}
			onChange={(next) => {
				setRejected(null)
				setDraft((current) => ({ ...current, [form]: next }))
			}}
			label={plural ? t('translationsPage.editor.formLabel', { label, form: t(`translationsPage.plural.forms.${form}`) }) : label}
			pluralHash={plural !== null}
			basePlaceholders={basePlaceholders}
			describedBy={describedBy}
			invalid={isInvalid(form)}
			readOnly={saving}
			maxLength={TRANSLATION_VALUE_MAX_LENGTH}
			modalAutofocus={index === 0}
			onKeyDown={handleKeyDown}
			className={classes.field}
		/>
	)

	const labelWithLanguage = (label: string, labelled: Language) => (
		<>
			<LanguageFlag code={labelled.flagCode} size='xs' />
			<span>{label} </span>
			<span className={classes.languageHint}>({t(`languageNames.${labelled.tag}`)})</span>
		</>
	)

	return (
		<>
			<div>
				<span className={classes.label}>{t('translationsPage.editModal.key')}</span>
				<span className={classes.key}>{item.name}</span>
				{item.description && <span className={`${classes.description} block`}>{item.description}</span>}
			</div>
			{baseValue !== undefined && baseLanguage && (
				<div>
					<div className={classes.labelRow}>
						<span className={`${classes.label} ${classes.labelWithLanguage}`}>
							{labelWithLanguage(t('translationsPage.editModal.baseLanguage'), baseLanguage)}
						</span>
						{baseValue !== null && (
							<RowAction
								icon={Copy}
								tooltip={t('translationsPage.editModal.copyBase')}
								label={t('translationsPage.editModal.copyBaseLabel', { language: t(`languageNames.${baseLanguage.tag}`) })}
								disabled={saving}
								onClick={() => copyBase(baseValue)}
							/>
						)}
					</div>
					<div className={classes.reference}>
						<TranslationValue value={baseValue} pluralTag={item.plural ? baseLanguage.tag : undefined} />
					</div>
				</div>
			)}
			<div>
				<span className={`${classes.label} ${classes.labelWithLanguage}`}>
					{labelWithLanguage(t('translationsPage.editModal.value'), language)}
					{lastEdit}
					{draftMismatch && <PlaceholderWarning missing={draftMismatch.missing} extra={draftMismatch.extra} />}
				</span>
				<div className={classes.forms}>
					{plural
						? forms.map((form, index) => (
								<div key={form} className={classes.formRow}>
									<PluralFormChip form={form} />
									{field(form, index)}
								</div>
							))
						: field(PLAIN, 0)}
				</div>
				<VisuallyHidden id={lockedHintId}>
					{[t('translationsPage.editor.lockedHint'), plural && t('translationsPage.editor.hashHint')].filter(Boolean).join(' ')}
				</VisuallyHidden>
				{message && (
					<span id={errorId} role='alert' className={classes.error}>
						{message}
					</span>
				)}
			</div>
			<div className={`${appModalClasses.footer} ${appModalClasses.footerInBody} flex flex-wrap items-center gap-2`}>
				<Button variant='default' onClick={onClose} disabled={saving}>
					{t('translationsPage.editModal.cancel')}
				</Button>
				<div className='ml-auto flex flex-wrap items-center justify-end gap-2'>
					<Button
						variant={onNext ? 'default' : 'filled'}
						loading={saving}
						disabled={isPristine}
						onClick={() => void save()}
						aria-keyshortcuts={onNext ? undefined : 'Meta+Enter Control+Enter'}
					>
						{t(onNext ? 'translationsPage.editModal.submitClose' : 'translationsPage.editModal.submit')}
					</Button>
					{onNext && (
						<Tooltip label={t('translationsPage.editModal.submitNextHint', { shortcut: SHORTCUT })}>
							<Button loading={saving} disabled={isPristine} onClick={() => void save(true)} aria-keyshortcuts='Meta+Enter Control+Enter'>
								{t('translationsPage.editModal.submitNext')}
							</Button>
						</Tooltip>
					)}
				</div>
			</div>
		</>
	)
}

export default EditTranslationModal
