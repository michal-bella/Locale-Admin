import { Button, Checkbox, Collapse, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	ERROR_CODE,
	IMPORT_FILE_MAX_BYTES,
	type ImportFileInvalidDetails,
	type ImportPreviewRequest,
	type ImportPreviewResponse,
	SUPPORTED_LANGUAGES,
} from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getImportFileIssues from '@/api/getImportFileIssues'
import { useImportMutation } from '@/api/imports/useImportMutation'
import { useImportPreviewMutation } from '@/api/imports/useImportPreviewMutation'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { useCreateProjectLanguageMutation } from '@/api/projectLanguages/useCreateProjectLanguageMutation'
import AppModal from '@/components/AppModal/AppModal'
import { ChevronDown } from '@/components/Icons'
import ImportDropzone from '@/components/ImportDropzone/ImportDropzone'
import ImportIssueList from '@/components/ImportIssueList/ImportIssueList'
import ImportReviewTable from '@/components/ImportReviewTable/ImportReviewTable'
import { type ImportColumnMapping } from '@/components/ImportReviewTable/types'
import { IMPORT_REQUEST_MAX_BYTES } from '@/lib/constants'

import classes from './ImportModal.module.css'
import { type ImportModalProps, type SelectedImportFile } from './types'

type Step = 'UPLOAD' | 'REVIEW'

const CSV_EXTENSION = /\.csv$/i

const MOBILE_QUERY = '(max-width: 48em)'

const requestBytes = (body: ImportPreviewRequest) => new TextEncoder().encode(JSON.stringify(body)).byteLength

/** Columns matched by tag keep their language; the user's choice for the other columns survives a repeated preview. */
const mergeMapping = (preview: ImportPreviewResponse, previous: ImportColumnMapping): ImportColumnMapping =>
	Object.fromEntries(
		preview.columns.map((column) => [column.columnIndex, column.match === 'PROJECT' ? (column.languageId ?? null) : previous[column.columnIndex]]),
	)

/**
 * Import of a CSV file in two steps (Figma 3:2042 for the first one): upload with local checks and the preview, then the review of
 * the language columns, warnings and counts, and the import itself. The file stays in memory between the steps.
 */
const ImportModal = ({ projectId, opened, onClose }: ImportModalProps) => {
	const { t } = useTranslation()
	const isMobile = useMediaQuery(MOBILE_QUERY) ?? false
	const { data: languages = [] } = useProjectLanguagesQuery(projectId)
	const previewMutation = useImportPreviewMutation(projectId)
	const importMutation = useImportMutation(projectId)
	const createLanguage = useCreateProjectLanguageMutation(projectId)

	const [step, setStep] = useState<Step>('UPLOAD')
	const [file, setFile] = useState<SelectedImportFile | null>(null)
	const [createMissingKeys, setCreateMissingKeys] = useState(true)
	const [fileError, setFileError] = useState<string>()
	const [fileIssues, setFileIssues] = useState<ImportFileInvalidDetails | null>(null)
	const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
	const [mapping, setMapping] = useState<ImportColumnMapping>({})
	const [addingTag, setAddingTag] = useState<string | null>(null)
	const [importError, setImportError] = useState<string>()
	const [placeholdersOpened, placeholders] = useDisclosure(false)

	const isPending = previewMutation.isPending || importMutation.isPending || createLanguage.isPending

	const resetAndClose = () => {
		setStep('UPLOAD')
		setFile(null)
		setCreateMissingKeys(true)
		setFileError(undefined)
		setFileIssues(null)
		setPreview(null)
		setMapping({})
		setAddingTag(null)
		setImportError(undefined)
		placeholders.close()
		previewMutation.reset()
		importMutation.reset()
		createLanguage.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const selectFile = (picked: File) => {
		setFileIssues(null)
		setFileError(undefined)
		setFile(null)
		if (!CSV_EXTENSION.test(picked.name)) {
			setFileError(t('importModal.dropzone.invalidType'))
			return
		}
		if (picked.size > IMPORT_FILE_MAX_BYTES) {
			setFileError(t('errors.IMPORT_FILE_TOO_LARGE'))
			return
		}
		const reader = new FileReader()
		reader.onload = () => {
			const content = typeof reader.result === 'string' ? reader.result : ''
			if (requestBytes({ fileName: picked.name, content }) > IMPORT_REQUEST_MAX_BYTES) {
				setFileError(t('errors.IMPORT_FILE_TOO_LARGE'))
				return
			}
			setFile({ name: picked.name, size: picked.size, content })
		}
		reader.onerror = () => setFileError(t('importModal.dropzone.readError'))
		reader.readAsText(picked, 'UTF-8')
	}

	const showFileIssues = (issues: ImportFileInvalidDetails) => {
		setFileIssues(issues)
		setPreview(null)
		setStep('UPLOAD')
	}

	const runPreview = (selected: SelectedImportFile) => {
		setImportError(undefined)
		previewMutation.mutate(
			{ fileName: selected.name, content: selected.content },
			{
				onSuccess: (data) => {
					setPreview(data)
					setMapping((previous) => mergeMapping(data, previous))
					setFileIssues(null)
					setStep('REVIEW')
				},
				onError: (error) => {
					const issues = getImportFileIssues(error)
					if (issues) {
						showFileIssues(issues)
						return
					}
					const message = t(`errors.${getApiErrorCode(error)}`)
					if (step === 'UPLOAD') {
						setFileError(message)
					} else {
						setImportError(message)
					}
				},
			},
		)
	}

	const addLanguage = (tag: string) => {
		const supported = SUPPORTED_LANGUAGES.find((language) => language.tag.toLowerCase() === tag.toLowerCase())
		if (!supported || !file) {
			return
		}
		setAddingTag(tag)
		setImportError(undefined)
		createLanguage.mutate(
			{ tag: supported.tag },
			{
				onSuccess: () => runPreview(file),
				onError: (error) => {
					// Someone else added it meanwhile; the new preview matches the column to it.
					if (getApiErrorCode(error) === ERROR_CODE.LANGUAGE_TAKEN) {
						runPreview(file)
						return
					}
					setImportError(t(`errors.${getApiErrorCode(error)}`))
				},
				onSettled: () => setAddingTag(null),
			},
		)
	}

	const submitImport = () => {
		if (!file || !preview) {
			return
		}
		setImportError(undefined)
		importMutation.mutate(
			{
				fileName: file.name,
				content: file.content,
				columns: preview.columns.map((column) => ({ columnIndex: column.columnIndex, languageId: mapping[column.columnIndex] ?? null })),
				createMissingKeys,
			},
			{
				onSuccess: (result) => {
					notifications.show({
						color: 'green',
						message: t('importModal.success', {
							keys: result.keysCreated,
							created: result.translationsCreated,
							updated: result.translationsUpdated,
						}),
					})
					resetAndClose()
				},
				onError: (error) => {
					const issues = getImportFileIssues(error)
					if (issues) {
						showFileIssues(issues)
						return
					}
					setImportError(t(`errors.${getApiErrorCode(error)}`))
				},
			},
		)
	}

	const mappedCount = preview ? preview.columns.filter((column) => typeof mapping[column.columnIndex] === 'string').length : 0

	// Counts come from the preview only for columns that keep the language matched by tag; a manually mapped column has none.
	const countedChanges = preview
		? preview.changes.filter((changes) => {
				const column = preview.columns.find((item) => item.columnIndex === changes.columnIndex)
				return column?.match === 'PROJECT' && mapping[changes.columnIndex] === column.languageId
			})
		: []
	const newTranslations = countedChanges.reduce((sum, changes) => sum + changes.new, 0)
	const overwritten = countedChanges.reduce((sum, changes) => sum + changes.changed, 0)
	const hasManualMapping =
		preview?.columns.some((column) => {
			const choice = mapping[column.columnIndex]
			return typeof choice === 'string' && !(column.match === 'PROJECT' && choice === column.languageId)
		}) ?? false
	const baseUntranslated = preview?.warnings.filter((issue) => issue.code === 'BASE_LANGUAGE_UNTRANSLATED') ?? []
	const placeholderMismatches = preview?.warnings.filter((issue) => issue.code === 'PLACEHOLDER_MISMATCH') ?? []
	const unlistedWarnings = preview ? preview.warningsTotal - preview.warnings.length : 0

	const footer =
		step === 'UPLOAD' ? (
			<>
				<Button variant='default' onClick={handleClose} disabled={isPending}>
					{t('importModal.cancel')}
				</Button>
				<Button loading={previewMutation.isPending} disabled={!file} onClick={() => file && runPreview(file)}>
					{t('importModal.continue')}
				</Button>
			</>
		) : (
			<>
				<Button variant='default' onClick={() => setStep('UPLOAD')} disabled={isPending}>
					{t('importModal.back')}
				</Button>
				<Button loading={importMutation.isPending} disabled={mappedCount === 0 || (isPending && !importMutation.isPending)} onClick={submitImport}>
					{t('importModal.submit')}
				</Button>
			</>
		)

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('importModal.title')}
			description={t('importModal.description')}
			closeLabel={t('importModal.close')}
			isPending={isPending}
			size='xl'
			fullScreen={isMobile}
			footer={footer}
		>
			<Text size='xs' fw={600} tt='uppercase' className={classes.step} aria-live='polite'>
				{step === 'UPLOAD' ? t('importModal.steps.upload') : t('importModal.steps.review')}
			</Text>
			{step === 'UPLOAD' && (
				<>
					<ImportDropzone file={file} onSelect={selectFile} disabled={previewMutation.isPending} error={fileError} />
					{fileIssues && <ImportIssueList title={t('errors.IMPORT_FILE_INVALID')} issues={fileIssues.issues} total={fileIssues.total} tone='error' />}
					<div className={classes.createKeys}>
						<Checkbox
							checked={createMissingKeys}
							onChange={(event) => setCreateMissingKeys(event.currentTarget.checked)}
							label={t('importModal.createMissingKeys.label')}
							description={t('importModal.createMissingKeys.description')}
							classNames={{ label: classes.createKeysLabel, description: classes.createKeysDescription }}
						/>
					</div>
				</>
			)}
			{step === 'REVIEW' && preview && (
				<>
					<ImportReviewTable
						preview={preview}
						languages={languages}
						mapping={mapping}
						onChange={(columnIndex, choice) => setMapping((previous) => ({ ...previous, [columnIndex]: choice }))}
						onAddLanguage={addLanguage}
						addingTag={addingTag}
						disabled={isPending}
					/>
					<div className={`${classes.summary} flex flex-col gap-2`}>
						<Text size='sm' fw={700} c='var(--app-color-title)'>
							{t('importModal.review.summary.title')}
						</Text>
						<ul className={classes.summaryList}>
							<li>
								{createMissingKeys
									? t('importModal.review.summary.newKeys', { count: preview.keys.new })
									: t('importModal.review.summary.newKeysSkipped', { count: preview.keys.new })}
							</li>
							<li>{t('importModal.review.summary.overwritten', { count: overwritten })}</li>
							<li>{t('importModal.review.summary.newTranslations', { count: newTranslations })}</li>
							{baseUntranslated.length > 0 && <li>{t('importModal.review.summary.baseUntranslated', { count: baseUntranslated.length })}</li>}
						</ul>
						{hasManualMapping && <Text size='xs'>{t('importModal.review.summary.approximate')}</Text>}
						{placeholderMismatches.length > 0 && (
							<div className='flex flex-col gap-2'>
								<Button
									variant='subtle'
									size='compact-sm'
									className='self-start'
									rightSection={<ChevronDown aria-hidden width={12} height={12} />}
									aria-expanded={placeholdersOpened}
									onClick={placeholders.toggle}
								>
									{t('importModal.review.summary.placeholderToggle', { count: placeholderMismatches.length })}
								</Button>
								<Collapse expanded={placeholdersOpened}>
									<ImportIssueList
										title={t('importModal.review.summary.placeholderTitle')}
										issues={placeholderMismatches}
										total={placeholderMismatches.length}
										tone='warning'
									/>
								</Collapse>
							</div>
						)}
						{unlistedWarnings > 0 && <Text size='xs'>{t('importModal.review.summary.moreWarnings', { count: unlistedWarnings })}</Text>}
					</div>
					{importError && (
						<Text size='sm' c='var(--mantine-color-error)' role='alert'>
							{importError}
						</Text>
					)}
				</>
			)}
		</AppModal>
	)
}

export default ImportModal
