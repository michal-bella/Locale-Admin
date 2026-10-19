import { Loader, Textarea, VisuallyHidden } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type PlaceholderMismatchDetails, TRANSLATION_VALUE_MAX_LENGTH } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getPlaceholderMismatch from '@/api/getPlaceholderMismatch'

import classes from './TranslationEditor.module.css'
import { type TranslationEditorProps } from './types'

const MAX_ROWS = 8

type SaveTrigger = 'blur' | 'keyboard'

/**
 * Target cell of the translations table. The read-only value is a button (Enter/Space open the editor natively, Tab goes straight to the
 * next row's cell because nothing else in a row is focusable). Editing is a plain-text `Textarea`: blur and Ctrl/Cmd+Enter save, Esc
 * restores. Empty or whitespace-only text saves `null`. The field stays open and read-only with a loader while saving, so a
 * `PLACEHOLDER_MISMATCH` can show its message under the field; a blur after that error without a change discards the draft.
 */
const TranslationEditor = ({ value, label, onSave, children }: TranslationEditorProps) => {
	const { t } = useTranslation()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState('')
	const [saving, setSaving] = useState(false)
	const [mismatch, setMismatch] = useState<PlaceholderMismatchDetails | null>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const focusButtonRef = useRef(false)

	useEffect(() => {
		if (editing) {
			const textarea = textareaRef.current
			textarea?.focus()
			textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
		} else if (focusButtonRef.current) {
			focusButtonRef.current = false
			buttonRef.current?.focus()
		}
	}, [editing])

	const open = () => {
		setDraft(value ?? '')
		setMismatch(null)
		setEditing(true)
	}

	// Focus returns to the button only when the user is still in the field (Esc, Ctrl+Enter), never after a blur.
	const close = () => {
		focusButtonRef.current = document.activeElement === textareaRef.current
		setMismatch(null)
		setEditing(false)
	}

	const save = async (trigger: SaveTrigger) => {
		const next = draft.trim() === '' ? null : draft
		if (next === value || (mismatch && trigger === 'blur')) {
			close()
			return
		}
		setSaving(true)
		try {
			await onSave(next)
			close()
		} catch (error) {
			const details = getPlaceholderMismatch(error)
			if (details) {
				setMismatch(details)
			} else {
				notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) })
				close()
			}
		} finally {
			setSaving(false)
		}
	}

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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

	if (!editing) {
		return (
			<button ref={buttonRef} type='button' className={classes.button} onClick={open}>
				<VisuallyHidden>{label}:</VisuallyHidden> {children}
			</button>
		)
	}

	const mismatchMessage =
		mismatch &&
		[
			t('errors.PLACEHOLDER_MISMATCH'),
			mismatch.missing.length > 0 && t('translationsPage.editor.missing', { list: mismatch.missing.join(', ') }),
			mismatch.extra.length > 0 && t('translationsPage.editor.extra', { list: mismatch.extra.join(', ') }),
		]
			.filter(Boolean)
			.join(' ')

	return (
		<Textarea
			ref={textareaRef}
			aria-label={label}
			value={draft}
			maxLength={TRANSLATION_VALUE_MAX_LENGTH}
			autosize
			minRows={1}
			maxRows={MAX_ROWS}
			readOnly={saving}
			description={t('translationsPage.editor.hint')}
			inputWrapperOrder={['input', 'description', 'error']}
			error={mismatchMessage && <span role='alert'>{mismatchMessage}</span>}
			rightSection={
				saving ? (
					<span role='status'>
						<Loader size='xs' />
						<VisuallyHidden>{t('translationsPage.editor.saving')}</VisuallyHidden>
					</span>
				) : undefined
			}
			classNames={{ root: classes.root, input: classes.input, description: classes.hint, error: classes.error }}
			onChange={(event) => setDraft(event.currentTarget.value)}
			onKeyDown={onKeyDown}
			onBlur={() => {
				if (!saving) {
					void save('blur')
				}
			}}
		/>
	)
}

export default TranslationEditor
