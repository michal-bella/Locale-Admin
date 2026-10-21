import { Alert, Badge, Button, Checkbox, Input, Radio, SegmentedControl, Text, TextInput, VisuallyHidden } from '@mantine/core'
import { useDidUpdate, useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	EXPORT_FILE_NAME_DEFAULT,
	type ExportFormat,
	exportFormatSchema,
	type ExportIssue,
	type ExportWarning,
	type ExportStatus,
	exportStatusSchema,
	type Language,
} from '@locale/shared'

import { useExportCheckQuery } from '@/api/exports/exportCheckQuery'
import { useExportMutation } from '@/api/exports/useExportMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import getExportUnsafeValues from '@/api/getExportUnsafeValues'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import AppModal from '@/components/AppModal/AppModal'
import { AlertTriangle, Download } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import { downloadFile } from '@/lib/downloadFile'

import classes from './ExportModal.module.css'
import { type ExportModalProps } from './types'

/** The cards of Figma; a format the API does not export yet (`exportFormatSchema`) is shown disabled. */
const FORMATS = ['JSON', 'CSV', 'XLSX', 'ARB'] as const

const isExportFormat = (value: string): value is ExportFormat => exportFormatSchema.safeParse(value).success

const extensionOf = (format: ExportFormat) => `.${format.toLowerCase()}`

const FILE_NAME_MAX_LENGTH = 100

/** Characters that Windows or macOS do not allow in a file name. */
const FILE_NAME_INVALID = /[\\/:*?"<>|]/

const MOBILE_QUERY = '(max-width: 48em)'

const toFileName = (value: string) => value.trim().replace(/\.(csv|xlsx)$/i, '')

type FileNameError = 'required' | 'invalid' | 'tooLong'

const validateFileName = (name: string): FileNameError | null => {
	if (name === '') {
		return 'required'
	}
	if (FILE_NAME_INVALID.test(name)) {
		return 'invalid'
	}
	return name.length > FILE_NAME_MAX_LENGTH ? 'tooLong' : null
}

/**
 * Export of the project translations (Figma 3:2768): format (CSV or XLSX), languages (all by default), status and file name. The server
 * streams the file, the browser saves it under the chosen name. Without Zahrnúť popisy a metadáta kľúčov (not part of the CSV format).
 */
const ExportModal = ({ projectId, opened, onClose }: ExportModalProps) => {
	const { t, i18n } = useTranslation()
	const isMobile = useMediaQuery(MOBILE_QUERY) ?? false
	const { data: languages = [] } = useProjectLanguagesQuery(projectId)
	const exportMutation = useExportMutation(projectId)
	const statusId = useId()
	const languagesRef = useRef<HTMLDivElement>(null)
	const fileNameRef = useRef<HTMLInputElement>(null)
	const alertRef = useRef<HTMLDivElement>(null)

	// `null` until the user changes the selection, so every language is selected by default, also the ones loaded later.
	const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
	const [format, setFormat] = useState<ExportFormat>('CSV')
	const [status, setStatus] = useState<ExportStatus>('ALL')
	const [fileName, setFileName] = useState(EXPORT_FILE_NAME_DEFAULT)
	const [submitted, setSubmitted] = useState(false)

	const languageIds = selectedIds ?? languages.map((language) => language.id)
	const languageName = (tag: Language['tag']) => {
		const name = t(`languageNames.${tag}`)
		return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1)
	}
	// The project order of the languages, as the export sends them; the key of the check changes only with the selection.
	const orderedIds = languages.filter((language) => languageIds.includes(language.id)).map((language) => language.id)
	const check = useExportCheckQuery(projectId, { languageIds: orderedIds, status }, opened && orderedIds.length > 0)
	const warnings = check.data && check.data.total > 0 ? check.data : null
	const name = toFileName(fileName)
	const extension = extensionOf(format)
	const languagesError = submitted && languageIds.length === 0 ? t('exportModal.languages.required') : undefined
	const fileNameProblem = validateFileName(name)
	const fileNameError = submitted && fileNameProblem ? t(`exportModal.fileName.${fileNameProblem}`, { max: FILE_NAME_MAX_LENGTH }) : undefined

	// The submit button is disabled while loading, so the focus falls to the body; the error is where the user has to continue.
	useDidUpdate(() => {
		if (exportMutation.isError) {
			alertRef.current?.focus()
		}
	}, [exportMutation.isError])

	const handleClose = () => {
		if (exportMutation.isPending) {
			return
		}
		setSelectedIds(null)
		setFormat('CSV')
		setStatus('ALL')
		setFileName(EXPORT_FILE_NAME_DEFAULT)
		setSubmitted(false)
		exportMutation.reset()
		onClose()
	}

	const submit = () => {
		setSubmitted(true)
		if (languageIds.length === 0) {
			languagesRef.current?.querySelector<HTMLElement>('[role="checkbox"]')?.focus()
			return
		}
		if (fileNameProblem) {
			fileNameRef.current?.focus()
			return
		}
		exportMutation.mutate(
			{ languageIds: orderedIds, status, format },
			{
				onSuccess: (blob) => {
					const fullName = `${name}${extension}`
					downloadFile(blob, fullName)
					notifications.show({ color: 'green', message: t('exportModal.success', { fileName: fullName }) })
					handleClose()
				},
			},
		)
	}

	const issueMessage = (issue: ExportIssue) => {
		const key = issue.namespace ? `${issue.namespace} / ${issue.key}` : issue.key
		if (issue.languageTag && (issue.code === 'SEMICOLON' || issue.code === 'LINE_BREAK')) {
			const language = languages.find((item) => item.tag === issue.languageTag)
			return t(`exportModal.issues.value.${issue.code}`, { key, language: language ? t(`languageNames.${language.tag}`) : issue.languageTag })
		}
		return t(`exportModal.issues.row.${issue.code}`, { key, namespace: issue.namespace })
	}

	const warningMessage = (warning: ExportWarning) => {
		const key = warning.namespace ? `${warning.namespace} / ${warning.key}` : warning.key
		const language = languages.find((item) => item.tag === warning.languageTag)
		const details = [
			warning.missing.length > 0 && t('exportModal.warnings.missing', { list: warning.missing.join(', ') }),
			warning.extra.length > 0 && t('exportModal.warnings.extra', { list: warning.extra.join(', ') }),
		]
			.filter(Boolean)
			.join(', ')
		return t('exportModal.warnings.item', { key, language: language ? t(`languageNames.${language.tag}`) : warning.languageTag, details })
	}

	const unsafeValues = getExportUnsafeValues(exportMutation.error)
	const errorCode = exportMutation.isError && !unsafeValues ? getApiErrorCode(exportMutation.error) : null
	const isPending = exportMutation.isPending

	const footer = (
		<>
			<Button variant='default' onClick={handleClose} disabled={isPending}>
				{t('exportModal.cancel')}
			</Button>
			<Button leftSection={<Download aria-hidden />} loading={isPending} onClick={submit}>
				{t('exportModal.submit', { format })}
			</Button>
		</>
	)

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('exportModal.title')}
			description={t('exportModal.description')}
			closeLabel={t('exportModal.close')}
			isPending={isPending}
			fullScreen={isMobile}
			footer={footer}
		>
			<Radio.Group label={t('exportModal.format.label')} value={format} onChange={(value) => isExportFormat(value) && setFormat(value)}>
				<div className={classes.formats}>
					{FORMATS.map((card) => (
						<Radio.Card
							key={card}
							value={card}
							disabled={!isExportFormat(card) || isPending}
							data-autofocus={card === format || undefined}
							className={classes.format}
						>
							<span className={classes.formatBadge} aria-hidden>
								{card}
							</span>
							<span className='flex min-w-0 flex-col'>
								<span className={classes.formatName}>{card}</span>
								<span className={classes.formatDescription}>{t(`exportModal.format.description.${card}`)}</span>
							</span>
							{isExportFormat(card) ? (
								<Radio.Indicator size='xs' className='ml-auto shrink-0' />
							) : (
								<Badge component='span' size='xs' variant='light' color='gray' className='ml-auto shrink-0'>
									{t('exportModal.format.soon')}
								</Badge>
							)}
						</Radio.Card>
					))}
				</div>
			</Radio.Group>
			<Checkbox.Group label={t('exportModal.languages.label')} value={languageIds} onChange={setSelectedIds} error={languagesError}>
				<div ref={languagesRef} className='flex flex-wrap gap-2 pt-2'>
					{languages.map((language) => (
						<Checkbox.Card key={language.id} value={language.id} disabled={isPending} className={classes.language}>
							<Checkbox.Indicator size='xs' radius='xs' className={classes.indicator} />
							<LanguageFlag code={language.flagCode} size='xs' />
							<span className={classes.languageLabel}>{languageName(language.tag)}</span>
						</Checkbox.Card>
					))}
				</div>
			</Checkbox.Group>
			<Input.Wrapper id={statusId} labelElement='div' label={t('exportModal.status.label')}>
				<SegmentedControl
					aria-labelledby={`${statusId}-label`}
					fullWidth
					disabled={isPending}
					value={status}
					onChange={setStatus}
					data={exportStatusSchema.options.map((value) => ({ value, label: t(`exportModal.status.${value}`) }))}
				/>
			</Input.Wrapper>
			<TextInput
				ref={fileNameRef}
				label={
					<>
						{t('exportModal.fileName.label')}
						<VisuallyHidden>{t('exportModal.fileName.extensionHint', { extension })}</VisuallyHidden>
					</>
				}
				value={fileName}
				onChange={(event) => setFileName(event.currentTarget.value)}
				error={fileNameError}
				disabled={isPending}
				rightSection={
					<Text size='sm' c='var(--app-color-text-secondary)'>
						{extension}
					</Text>
				}
				rightSectionWidth={56}
			/>
			{warnings && (
				<div className={`${classes.warnings} flex flex-col gap-2`}>
					<Text size='sm' fw={600} className={`${classes.warningsTitle} flex items-center gap-1`}>
						<AlertTriangle aria-hidden />
						{t('exportModal.warnings.title', { count: warnings.total })}
					</Text>
					<Text size='xs'>{t('exportModal.warnings.description')}</Text>
					<ul className={classes.warningsList}>
						{warnings.warnings.map((warning) => (
							<li key={`${warning.keyId}:${warning.languageTag}`}>{warningMessage(warning)}</li>
						))}
					</ul>
					{warnings.total > warnings.warnings.length && (
						<Text size='xs'>{t('exportModal.issues.more', { count: warnings.total - warnings.warnings.length })}</Text>
					)}
				</div>
			)}
			{unsafeValues && (
				<Alert ref={alertRef} tabIndex={-1} color='red' title={t('errors.EXPORT_VALUE_UNSAFE')}>
					<ul className={classes.issues}>
						{unsafeValues.issues.map((issue) => {
							return <li key={`${issue.keyId}:${issue.languageTag ?? ''}:${issue.code}`}>{issueMessage(issue)}</li>
						})}
					</ul>
					{unsafeValues.total > unsafeValues.issues.length && (
						<Text size='sm' mt='xs'>
							{t('exportModal.issues.more', { count: unsafeValues.total - unsafeValues.issues.length })}
						</Text>
					)}
				</Alert>
			)}
			{errorCode && (
				<Alert ref={alertRef} tabIndex={-1} color='red'>
					{t(`errors.${errorCode}`)}
				</Alert>
			)}
		</AppModal>
	)
}

export default ExportModal
