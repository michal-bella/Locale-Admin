import { Alert, Badge, Button, Checkbox, Input, Radio, SegmentedControl, Text, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EXPORT_FILE_NAME_DEFAULT, type ExportStatus, type Language } from '@locale/shared'

import { useExportMutation } from '@/api/exports/useExportMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import getExportUnsafeValues from '@/api/getExportUnsafeValues'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import AppModal from '@/components/AppModal/AppModal'
import { Download } from '@/components/Icons'
import { downloadFile } from '@/lib/downloadFile'

import classes from './ExportModal.module.css'
import { type ExportModalProps } from './types'

/** CSV is the only format for now; the others are shown disabled as in Figma. */
const FORMATS = [
	{ value: 'JSON', enabled: false },
	{ value: 'CSV', enabled: true },
	{ value: 'XLSX', enabled: false },
	{ value: 'ARB', enabled: false },
] as const

const STATUSES: ExportStatus[] = ['ALL', 'TRANSLATED', 'UNTRANSLATED']

const FILE_EXTENSION = '.csv'

const FILE_NAME_MAX_LENGTH = 100

/** Characters that Windows or macOS do not allow in a file name. */
const FILE_NAME_INVALID = /[\\/:*?"<>|]/

const MOBILE_QUERY = '(max-width: 48em)'

const toFileName = (value: string) => value.trim().replace(/\.csv$/i, '')

/**
 * Export of the project translations (Figma 3:2768): format, languages (all by default), status and file name. The server streams the
 * CSV, the browser saves it under the chosen name. Without Zahrnúť popisy a metadáta kľúčov (not part of the CSV format).
 */
const ExportModal = ({ projectId, opened, onClose }: ExportModalProps) => {
	const { t, i18n } = useTranslation()
	const isMobile = useMediaQuery(MOBILE_QUERY) ?? false
	const { data: languages = [] } = useProjectLanguagesQuery(projectId)
	const exportMutation = useExportMutation(projectId)
	const statusId = useId()

	// `null` until the user changes the selection, so every language is selected by default, also the ones loaded later.
	const [selectedIds, setSelectedIds] = useState<string[] | null>(null)
	const [status, setStatus] = useState<ExportStatus>('ALL')
	const [fileName, setFileName] = useState(EXPORT_FILE_NAME_DEFAULT)
	const [submitted, setSubmitted] = useState(false)

	const languageIds = selectedIds ?? languages.map((language) => language.id)
	const languageName = (tag: Language['tag']) => {
		const name = t(`languageNames.${tag}`)
		return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1)
	}
	const name = toFileName(fileName)
	const languagesError = submitted && languageIds.length === 0 ? t('exportModal.languages.required') : undefined
	const fileNameError = (() => {
		if (!submitted) {
			return undefined
		}
		if (name === '') {
			return t('exportModal.fileName.required')
		}
		if (FILE_NAME_INVALID.test(name)) {
			return t('exportModal.fileName.invalid')
		}
		return name.length > FILE_NAME_MAX_LENGTH ? t('exportModal.fileName.tooLong', { max: FILE_NAME_MAX_LENGTH }) : undefined
	})()

	const handleClose = () => {
		if (exportMutation.isPending) {
			return
		}
		setSelectedIds(null)
		setStatus('ALL')
		setFileName(EXPORT_FILE_NAME_DEFAULT)
		setSubmitted(false)
		exportMutation.reset()
		onClose()
	}

	const submit = () => {
		setSubmitted(true)
		if (languageIds.length === 0 || name === '' || FILE_NAME_INVALID.test(name) || name.length > FILE_NAME_MAX_LENGTH) {
			return
		}
		// The request keeps the project order of the languages, the server orders the columns the same way.
		const ordered = languages.filter((language) => languageIds.includes(language.id)).map((language) => language.id)
		exportMutation.mutate(
			{ languageIds: ordered, status },
			{
				onSuccess: (blob) => {
					const fullName = `${name}${FILE_EXTENSION}`
					downloadFile(blob, fullName)
					notifications.show({ color: 'green', message: t('exportModal.success', { fileName: fullName }) })
					handleClose()
				},
			},
		)
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
				{t('exportModal.submit')}
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
			<Radio.Group label={t('exportModal.format.label')} value='CSV'>
				<div className={classes.formats}>
					{FORMATS.map((format) => (
						<Radio.Card key={format.value} value={format.value} disabled={!format.enabled} className={classes.format}>
							<span className={classes.formatBadge} aria-hidden>
								{format.value}
							</span>
							<span className='flex min-w-0 flex-col'>
								<span className={classes.formatName}>{format.value}</span>
								<span className={classes.formatDescription}>{t(`exportModal.format.description.${format.value}`)}</span>
							</span>
							{!format.enabled && (
								<Badge size='xs' variant='light' color='gray' className='ml-auto shrink-0'>
									{t('exportModal.format.soon')}
								</Badge>
							)}
						</Radio.Card>
					))}
				</div>
			</Radio.Group>
			<Checkbox.Group label={t('exportModal.languages.label')} value={languageIds} onChange={setSelectedIds} error={languagesError}>
				<div className='flex flex-wrap gap-2 pt-2'>
					{languages.map((language) => (
						<Checkbox.Card key={language.id} value={language.id} disabled={isPending} className={classes.language}>
							<Checkbox.Indicator size='xs' radius='xs' />
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
					data={STATUSES.map((value) => ({ value, label: t(`exportModal.status.${value}`) }))}
				/>
			</Input.Wrapper>
			<TextInput
				label={t('exportModal.fileName.label')}
				value={fileName}
				onChange={(event) => setFileName(event.currentTarget.value)}
				error={fileNameError}
				disabled={isPending}
				rightSection={<Text size='sm'>{FILE_EXTENSION}</Text>}
				rightSectionWidth={48}
			/>
			{unsafeValues && (
				<Alert color='red' title={t('errors.EXPORT_VALUE_UNSAFE')} role='alert'>
					<ul className={classes.issues}>
						{unsafeValues.issues.map((issue) => {
							const key = issue.namespace ? `${issue.namespace} / ${issue.key}` : issue.key
							const language = languages.find((item) => item.tag === issue.languageTag)
							const message = issue.languageTag
								? t(`exportModal.issues.value.${issue.code}`, {
										key,
										language: language ? t(`languageNames.${language.tag}`) : issue.languageTag,
									})
								: t(`exportModal.issues.row.${issue.code}`, { key })
							return <li key={`${issue.keyId}:${issue.languageTag ?? ''}:${issue.code}`}>{message}</li>
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
				<Alert color='red' role='alert'>
					{t(`errors.${errorCode}`)}
				</Alert>
			)}
		</AppModal>
	)
}

export default ExportModal
