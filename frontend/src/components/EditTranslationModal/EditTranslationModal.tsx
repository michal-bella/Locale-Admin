import { Button, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	hasBalancedBraces,
	type Language,
	type PlaceholderMismatchDetails,
	type PluralForm,
	serializePluralValue,
	TRANSLATION_VALUE_MAX_LENGTH,
	type TranslationListItem,
	updateTranslationRequestSchema,
	VALIDATION_CODE,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import getPlaceholderMismatch from '@/api/getPlaceholderMismatch'
import AppModal from '@/components/AppModal/AppModal'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import PluralFormChip from '@/components/PluralForms/PluralFormChip'
import TokenEditor from '@/components/TokenEditor/TokenEditor'
import TranslationValue from '@/components/TranslationValue/TranslationValue'
import { parsePluralForms, pluralFormsOf } from '@/lib/pluralForms'

import classes from './EditTranslationModal.module.css'
import { type EditTranslationModalProps } from './types'

type Rejection =
	{ kind: 'mismatch'; details: PlaceholderMismatchDetails } | { kind: 'unbalanced'; forms: PluralForm[] } | { kind: 'tooLong' } | { kind: 'invalid' }

type Draft = Partial<Record<PluralForm, string>>

const PLAIN: PluralForm = 'other'

/**
 * "Upraviť preklad": the key, the language, the base language value as a reference and a `TokenEditor` per form (one for a plain key).
 * Saves only with the button. Empty or whitespace-only text saves `null`; for a plural key the forms are saved as one ICU message (empty
 * forms kept, all empty → `null`) after checking that every form keeps `{`/`}` balanced and the whole message fits
 * `TRANSLATION_VALUE_MAX_LENGTH`. `PLACEHOLDER_MISMATCH` and an unparseable plural (`VALIDATION_ERROR` on `value`) show under the
 * fields and keep the modal open; any other error shows a notification. `key` on the content resets the draft for every key and language.
 */
const EditTranslationModal = ({ item, language, baseLanguage, opened, onClose, onSave }: EditTranslationModalProps) => {
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
				/>
			)}
		</AppModal>
	)
}

type FieldsProps = Pick<EditTranslationModalProps, 'baseLanguage' | 'onClose' | 'onSave'> & {
	item: TranslationListItem
	language: Language
	saving: boolean
	setSaving: (saving: boolean) => void
}

const Fields = ({ item, language, baseLanguage, saving, setSaving, onClose, onSave }: FieldsProps) => {
	const { t } = useTranslation()
	const value = item.translations[language.id]?.value ?? null
	const plural = item.plural ? { variable: item.plural.variable, tag: language.tag } : null
	const forms: PluralForm[] = plural ? pluralFormsOf(plural.tag, parsePluralForms(value)) : [PLAIN]
	const [draft, setDraft] = useState<Draft>(() => (plural ? parsePluralForms(value) : { [PLAIN]: value ?? '' }))
	const [rejected, setRejected] = useState<Rejection | null>(null)
	const label = t('translationsPage.editor.label', { key: item.name, language: language.nativeName })
	const lockedHintId = useId()
	const errorId = useId()
	const baseValue = baseLanguage && baseLanguage.id !== language.id ? (item.translations[baseLanguage.id]?.value ?? null) : undefined

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

	const save = async () => {
		if (saving) {
			return
		}
		const next = composeValue()
		if (next === value) {
			onClose()
			return
		}
		const rejection = validate(next)
		if (rejection) {
			setRejected(rejection)
			return
		}
		setSaving(true)
		try {
			await onSave(item.keyId, language.id, next)
			onClose()
		} catch (error) {
			const details = getPlaceholderMismatch(error)
			if (details) {
				setRejected({ kind: 'mismatch', details })
			} else if (getApiErrorDetails(error).some((issue) => issue.path === 'value' && issue.code === VALIDATION_CODE.INVALID)) {
				setRejected({ kind: 'invalid' })
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

	const field = (form: PluralForm, index: number) => (
		<TokenEditor
			key={form}
			value={draft[form] ?? ''}
			onChange={(next) => {
				setRejected(null)
				setDraft((current) => ({ ...current, [form]: next }))
			}}
			label={plural ? t('translationsPage.editor.formLabel', { label, form: t(`translationsPage.plural.forms.${form}`) }) : label}
			pluralHash={plural !== null}
			describedBy={describedBy}
			invalid={isInvalid(form)}
			readOnly={saving}
			maxLength={TRANSLATION_VALUE_MAX_LENGTH}
			modalAutofocus={index === 0}
			className={classes.field}
		/>
	)

	return (
		<>
			<div>
				<span className={classes.label}>{t('translationsPage.editModal.key')}</span>
				<span className={classes.key}>{item.name}</span>
				{item.description && <span className={`${classes.description} block`}>{item.description}</span>}
			</div>
			<div>
				<span className={classes.label}>{t('translationsPage.editModal.language')}</span>
				<span className={classes.language}>
					<LanguageFlag code={language.flagCode} size='sm' />
					{language.nativeName}
				</span>
			</div>
			{baseValue !== undefined && baseLanguage && (
				<div>
					<span className={classes.label}>{t('translationsPage.editModal.baseLanguage', { language: baseLanguage.nativeName })}</span>
					<div className={classes.reference}>
						<TranslationValue value={baseValue} pluralTag={item.plural ? baseLanguage.tag : undefined} />
					</div>
				</div>
			)}
			<div>
				<span className={classes.label}>{t('translationsPage.editModal.value')}</span>
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
			<div className='flex items-center justify-end gap-2'>
				<Button variant='default' onClick={onClose} disabled={saving}>
					{t('translationsPage.editModal.cancel')}
				</Button>
				<Button loading={saving} onClick={() => void save()}>
					{t('translationsPage.editModal.submit')}
				</Button>
			</div>
		</>
	)
}

export default EditTranslationModal
