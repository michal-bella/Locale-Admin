import { Button, Checkbox, Collapse, Select, Text } from '@mantine/core'
import { useDidUpdate, useDisclosure, useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useId, useRef, useState } from 'react'
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
import { ChevronDown, Plus } from '@/components/Icons'
import ImportDropzone from '@/components/ImportDropzone/ImportDropzone'
import ImportIssueList from '@/components/ImportIssueList/ImportIssueList'
import ImportReviewTable from '@/components/ImportReviewTable/ImportReviewTable'
import { type ImportColumnMapping } from '@/components/ImportReviewTable/types'
import VersionFormModal from '@/components/VersionFormModal/VersionFormModal'
import { IMPORT_REQUEST_MAX_BYTES } from '@/lib/constants'

import classes from './ImportModal.module.css'
import { type ImportModalProps, type SelectedImportFile } from './types'

type Step = 'UPLOAD' | 'REVIEW'

const CSV_EXTENSION = /\.csv$/i

const MOBILE_QUERY = '(max-width: 48em)'

/** Select value for an import without a version; a version is its id. */
const NO_VERSION = 'NONE'

/** Above the import modal (Mantine's default modal z-index is 200). */
const VERSION_MODAL_Z_INDEX = 300

const requestBytes = (body: ImportPreviewRequest) => new TextEncoder().encode(JSON.stringify(body)).byteLength

/** The user's choice survives a repeated preview; a column without one takes the language matched by tag. */
const mergeMapping = (preview: ImportPreviewResponse, previous: ImportColumnMapping): ImportColumnMapping =>
	Object.fromEntries(
		preview.columns.map((column) => {
			const previousChoice = previous[column.columnIndex]
			if (previousChoice !== undefined) {
				return [column.columnIndex, previousChoice]
			}
			return [column.columnIndex, column.match === 'PROJECT' ? (column.languageId ?? null) : undefined]
		}),
	)

/**
 * Import of a CSV file in two steps (Figma 3:2042 for the first one): upload with local checks and the preview, then the review of
 * the language columns, warnings and counts, and the import itself. The file stays in memory between the steps.
 */
const ImportModal = ({ projectId, versions, defaultVersionId, opened, onClose }: ImportModalProps) => {
	const { t } = useTranslation()
	const isMobile = useMediaQuery(MOBILE_QUERY) ?? false
	const { data: languages = [] } = useProjectLanguagesQuery(projectId)
	const previewMutation = useImportPreviewMutation(projectId)
	const importMutation = useImportMutation(projectId)
	const createLanguage = useCreateProjectLanguageMutation(projectId)

	const [step, setStep] = useState<Step>('UPLOAD')
	const [file, setFile] = useState<SelectedImportFile | null>(null)
	const [createMissingKeys, setCreateMissingKeys] = useState(true)
	// `null` until the user picks: the version filtered on the page, else the current one by date, none without one (also for a version created meanwhile).
	const [pickedVersionId, setPickedVersionId] = useState<string | null>(null)
	const [versionFormOpened, versionForm] = useDisclosure(false)
	const [fileError, setFileError] = useState<string>()
	const [fileIssues, setFileIssues] = useState<ImportFileInvalidDetails | null>(null)
	const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
	const [mapping, setMapping] = useState<ImportColumnMapping>({})
	const [addingTag, setAddingTag] = useState<string | null>(null)
	const [importError, setImportError] = useState<string>()
	const [placeholdersOpened, placeholders] = useDisclosure(false)
	const stepRef = useRef<HTMLHeadingElement>(null)
	const placeholdersId = useId()
	const nothingMappedId = useId()
	const summaryTitleId = useId()

	// The footer button that triggered the step change is disabled or replaced, so focus would fall back to the body otherwise.
	useDidUpdate(() => {
		if (opened) {
			stepRef.current?.focus()
		}
	}, [step])

	const isPending = previewMutation.isPending || importMutation.isPending || createLanguage.isPending

	const versionId =
		pickedVersionId ?? versions.find((version) => version.id === defaultVersionId)?.id ?? versions.find((version) => version.isCurrent)?.id ?? NO_VERSION
	const selectedVersion = versions.find((version) => version.id === versionId)

	const resetAndClose = () => {
		setStep('UPLOAD')
		setFile(null)
		setCreateMissingKeys(true)
		setPickedVersionId(null)
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
		setPreview(null)
		setMapping({})
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
				// Left out without a version: the API defaults to none, and a project without versions sends the same body as before.
				...(versionId === NO_VERSION ? {} : { versionId }),
			},
			{
				onSuccess: (result) => {
					notifications.show({
						color: 'green',
						message: t('importModal.success', {
							keys: t('importModal.successKeys', { count: result.keysCreated }),
							translations: t('importModal.successTranslations', { count: result.translationsCreated }),
							overwritten: t('importModal.successOverwritten', { count: result.translationsUpdated }),
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
	const skippedCount = preview ? preview.columns.length - mappedCount : 0

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
				<Button
					loading={importMutation.isPending}
					disabled={mappedCount === 0 || (isPending && !importMutation.isPending)}
					aria-describedby={mappedCount === 0 ? nothingMappedId : undefined}
					onClick={submitImport}
				>
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
			inBackground={versionFormOpened}
			size={step === 'UPLOAD' ? 'xl' : 960}
			fullScreen={isMobile}
			footer={footer}
		>
			<Text component='h3' ref={stepRef} tabIndex={-1} size='xs' fw={600} tt='uppercase' className={classes.step}>
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
					<div className='flex flex-wrap items-end gap-2'>
						<Select
							label={t('importModal.version.label')}
							description={t('importModal.version.description')}
							className='min-w-64 flex-1'
							data={[
								{ value: NO_VERSION, label: t('importModal.version.none') },
								...versions.map((version) => ({
									value: version.id,
									label: version.isCurrent ? t('importModal.version.current', { name: version.name }) : version.name,
								})),
							]}
							value={versionId}
							onChange={(value) => setPickedVersionId(value ?? NO_VERSION)}
							allowDeselect={false}
							disabled={isPending}
						/>
						<Button variant='default' leftSection={<Plus aria-hidden />} onClick={versionForm.open} disabled={isPending}>
							{t('importModal.version.create')}
						</Button>
					</div>
					<VersionFormModal
						projectId={projectId}
						opened={versionFormOpened}
						version={null}
						onClose={versionForm.close}
						onCreated={(version) => setPickedVersionId(version.id)}
						zIndex={VERSION_MODAL_Z_INDEX}
					/>
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
						<Text component='h4' id={summaryTitleId} size='sm' fw={700} c='var(--app-color-title)'>
							{t('importModal.review.summary.title')}
						</Text>
						<ul className={classes.summaryList} aria-labelledby={summaryTitleId}>
							<li>
								{createMissingKeys
									? t('importModal.review.summary.newKeys', { count: preview.keys.new })
									: t('importModal.review.summary.newKeysSkipped', { count: preview.keys.new })}
							</li>
							<li>{t('importModal.review.summary.overwritten', { count: overwritten })}</li>
							<li>{t('importModal.review.summary.newTranslations', { count: newTranslations })}</li>
							{baseUntranslated.length > 0 && <li>{t('importModal.review.summary.baseUntranslated', { count: baseUntranslated.length })}</li>}
							{skippedCount > 0 && <li>{t('importModal.review.summary.skippedColumns', { count: skippedCount })}</li>}
							{selectedVersion && <li>{t('importModal.review.summary.version', { name: selectedVersion.name })}</li>}
						</ul>
						{mappedCount === 0 && (
							<Text id={nothingMappedId} size='xs'>
								{t('importModal.review.summary.nothingMapped')}
							</Text>
						)}
						{hasManualMapping && <Text size='xs'>{t('importModal.review.summary.approximate')}</Text>}
						{placeholderMismatches.length > 0 && (
							<div className='flex flex-col gap-2'>
								<Button
									variant='subtle'
									size='compact-sm'
									className='self-start'
									rightSection={<ChevronDown aria-hidden width={12} height={12} />}
									aria-expanded={placeholdersOpened}
									aria-controls={placeholdersId}
									onClick={placeholders.toggle}
								>
									{t('importModal.review.summary.placeholderToggle', { count: placeholderMismatches.length })}
								</Button>
								<Collapse id={placeholdersId} expanded={placeholdersOpened}>
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
