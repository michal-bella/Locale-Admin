import { Text } from '@mantine/core'
import { type DragEvent, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IMPORT_FILE_MAX_BYTES } from '@locale/shared'

import { Upload } from '@/components/Icons'
import { formatFileSize } from '@/lib/formatFileSize'

import classes from './ImportDropzone.module.css'
import { type ImportDropzoneProps } from './types'

const MEGABYTE = 1024 * 1024

/**
 * File picker of the import (Figma 3:2393): a native file input inside a label that is also a drop target, so the whole area
 * opens the dialog on click and Enter/Space, and the input stays in the tab order (visually hidden, not `display: none`).
 */
const ImportDropzone = ({ file, onSelect, disabled = false, error }: ImportDropzoneProps) => {
	const { t, i18n } = useTranslation()
	const inputId = useId()
	const hintId = useId()
	const errorId = useId()
	const [dragging, setDragging] = useState(false)

	const pick = (files: FileList | null) => {
		const picked = files?.[0]
		if (picked && !disabled) {
			onSelect(picked)
		}
	}

	const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
		event.preventDefault()
		if (!disabled) {
			setDragging(true)
		}
	}

	const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
		event.preventDefault()
		setDragging(false)
		pick(event.dataTransfer.files)
	}

	return (
		<div className='flex flex-col gap-2'>
			<label
				htmlFor={inputId}
				className={`${classes.root} flex flex-col items-center gap-4 text-center`}
				data-dragging={dragging || undefined}
				data-disabled={disabled || undefined}
				onDragOver={handleDragOver}
				onDragLeave={() => setDragging(false)}
				onDrop={handleDrop}
			>
				<input
					id={inputId}
					type='file'
					accept='.csv,text/csv'
					className={classes.input}
					disabled={disabled}
					aria-label={t('importModal.dropzone.label')}
					aria-describedby={error ? `${hintId} ${errorId}` : hintId}
					aria-invalid={error ? true : undefined}
					onChange={(event) => {
						pick(event.target.files)
						// Choosing the same file again (after fixing it) must fire `change` too.
						event.target.value = ''
					}}
				/>
				<span className={classes.iconTile}>
					<Upload aria-hidden width={22} height={22} />
				</span>
				<span className='flex flex-col gap-1.5'>
					<Text component='span' size='sm' fw={600} c='var(--app-color-text-strong)' className={classes.prompt}>
						{file ? file.name : t('importModal.dropzone.prompt')}
					</Text>
					<Text component='span' id={hintId} size='xs'>
						{file
							? t('importModal.dropzone.replace', { size: formatFileSize(file.size, i18n.language) })
							: t('importModal.dropzone.hint', { max: IMPORT_FILE_MAX_BYTES / MEGABYTE })}
					</Text>
				</span>
			</label>
			<div className='flex items-center gap-2'>
				<span className={classes.chip}>{t('importModal.dropzone.format')}</span>
			</div>
			{error && (
				<Text id={errorId} size='xs' c='var(--mantine-color-error)' role='alert'>
					{error}
				</Text>
			)}
		</div>
	)
}

export default ImportDropzone
