import { Button, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ROLE, type TranslationsLayout, type TranslationsView } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useUpdatePreferencesMutation } from '@/api/profile/useUpdatePreferencesMutation'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { useProjectSettingsQuery } from '@/api/projectSettings/projectSettingsQuery'
import { useTranslationsQuery } from '@/api/translations/translationsQuery'
import { useUpdateTranslationMutation } from '@/api/translations/useUpdateTranslationMutation'
import ExportModal from '@/components/ExportModal/ExportModal'
import { Download, Upload } from '@/components/Icons'
import ImportModal from '@/components/ImportModal/ImportModal'
import PageIntro from '@/components/PageIntro/PageIntro'
import TranslationStats from '@/components/TranslationStats/TranslationStats'
import TranslationsPagination from '@/components/TranslationsPagination/TranslationsPagination'
import TranslationsTable from '@/components/TranslationsTable/TranslationsTable'
import TranslationsToolbar from '@/components/TranslationsToolbar/TranslationsToolbar'
import TranslationsViewControls from '@/components/TranslationsViewControls/TranslationsViewControls'
import { TRANSLATIONS_PAGE_SIZES, type TranslationsSearch } from '@/routes/projectTranslationsRoute'

import classes from './TranslationsPage.module.css'

const ROUTE_ID = '/_authenticated/_app/projects/$projectSlug/translations'

/**
 * Translations of the project (Figma 3:2): stats, filters in the URL, the table (cells open the edit modal) and pagination. The view is the
 * user's preference (`me.preferences.translationsView`): `EXTENDED` lists every language of the project and the API decides the row status
 * by all of them (no language ids in the query); `?languages=` narrows its columns to the base language plus the chosen ones without changing
 * the row status. `COMPACT` is the Figma source → target pair. Either view lays its languages side by side or stacked, also a preference
 * (`me.preferences.translationsLayout`). Without Posledný sync and the Na kontrolu card. Importovať (ADMIN only) opens `ImportModal`, Exportovať (every member) `ExportModal`.
 */
const TranslationsPage = () => {
	const { t } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const search = useSearch({ from: ROUTE_ID })
	const navigate = useNavigate({ from: '/projects/$projectSlug/translations' })
	const { data: project } = useProjectSettingsQuery(projectId)
	const { data: me } = useMeQuery()
	const isAdmin = me?.role === ROLE.ADMIN
	const view: TranslationsView = me?.preferences.translationsView ?? 'EXTENDED'
	const layout: TranslationsLayout = me?.preferences.translationsLayout ?? 'COLUMNS'
	const updatePreferences = useUpdatePreferencesMutation()
	const languagesQuery = useProjectLanguagesQuery(projectId)
	const languages = languagesQuery.data ?? []
	const [importOpened, importModal] = useDisclosure(false)
	const [exportOpened, exportModal] = useDisclosure(false)
	const importButtonRef = useRef<HTMLButtonElement>(null)

	// Importovať in the empty state is gone once the import added keys, so Mantine has nothing to return the focus to; the header button
	// takes it (Mantine still moves it to the original trigger 10 ms later when that one is still there).
	const closeImport = () => {
		importModal.close()
		importButtonRef.current?.focus()
	}

	const baseLanguage = languages.find((language) => language.isBase) ?? languages[0]
	const sourceLanguage = languages.find((language) => language.tag === search.source) ?? baseLanguage
	const targetLanguage =
		languages.find((language) => language.tag === search.target) ?? languages.find((language) => language.id !== sourceLanguage?.id) ?? sourceLanguage
	const shownLanguageTags = view === 'EXTENDED' ? search.languages : undefined
	const tableLanguages = shownLanguageTags ? languages.filter((language) => language.isBase || shownLanguageTags.includes(language.tag)) : languages
	const sort = search.sort ?? 'UNTRANSLATED_FIRST'
	const page = search.page ?? 1
	const pageSize = search.pageSize ?? TRANSLATIONS_PAGE_SIZES[0]

	const filters = {
		search: search.search,
		status: search.status,
		namespace: search.namespace,
		updatedById: search.updatedBy,
		updatedWithin: search.updatedWithin,
		sort,
		page,
		pageSize,
	}
	const listQuery =
		sourceLanguage && targetLanguage
			? view === 'COMPACT'
				? { sourceLanguageId: sourceLanguage.id, targetLanguageId: targetLanguage.id, ...filters }
				: filters
			: null
	const translationsQuery = useTranslationsQuery(projectId, listQuery)
	const data = translationsQuery.data
	const updateTranslation = useUpdateTranslationMutation(projectId, listQuery)
	const [savedAnnouncement, setSavedAnnouncement] = useState('')

	// The status badge flips silently for a screen reader; the live region below says it. Clearing first makes a repeated save of the same key announce again.
	const saveTranslation = async (keyId: string, languageId: string, value: string | null) => {
		setSavedAnnouncement('')
		const result = await updateTranslation.mutateAsync({ keyId, languageId, value })
		setSavedAnnouncement(t('translationsPage.editor.saved', { key: data?.items.find((item) => item.keyId === keyId)?.name ?? '' }))
		return result
	}

	const changePreferences = (preferences: { translationsView: TranslationsView } | { translationsLayout: TranslationsLayout }) =>
		updatePreferences.mutate(preferences, {
			onError: (error) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) }),
		})

	const updateSearch = (patch: Partial<TranslationsSearch>, { resetPage = true } = {}) =>
		void navigate({ search: (previous) => ({ ...previous, ...patch, ...(resetPage ? { page: undefined } : {}) }), replace: true })

	// A page past the end (shared link, or the last page shrank) goes to the last page instead of showing "no results".
	const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
	const isPastEnd = !translationsQuery.isPlaceholderData && data !== undefined && data.total > 0 && data.items.length === 0 && page > lastPage
	useEffect(() => {
		if (isPastEnd) {
			void navigate({ search: (previous) => ({ ...previous, page: lastPage === 1 ? undefined : lastPage }), replace: true })
		}
	}, [isPastEnd, lastPage, navigate])

	const clearFilters = () => updateSearch({ search: undefined, status: undefined, namespace: undefined, updatedBy: undefined, updatedWithin: undefined })

	const retry = async () => {
		const languagesResult = languagesQuery.isError ? await languagesQuery.refetch() : languagesQuery
		if (languagesResult.isError) {
			return false
		}
		const translationsResult = translationsQuery.isError ? await translationsQuery.refetch() : translationsQuery
		return !translationsResult.isError
	}

	const isError = languagesQuery.isError || translationsQuery.isError
	const hasLanguages = languages.length > 0
	const isPending = !isError && (languagesQuery.isPending || (hasLanguages && translationsQuery.isPending) || isPastEnd)

	// The search commits 300 ms after typing and the table changes silently; one polite region says what the list shows now.
	const resultsAnnouncement = (() => {
		if (isPending || isError) {
			return ''
		}
		if (!data || data.stats.totalKeys === 0) {
			return t('translationsPage.table.empty')
		}
		if (data.items.length === 0) {
			return t('translationsPage.table.noResults')
		}
		return t('translationsPage.pagination.summary', { shown: data.items.length, count: data.total })
	})()

	// The extended table (14rem key + 14rem per language + 8.5rem status) outgrows the 1440 px frame from the fourth language on; the page then
	// uses the full width and keeps only the padding.
	const isWide = view === 'EXTENDED' && layout === 'COLUMNS' && tableLanguages.length > 3

	return (
		<div className={`mx-auto flex w-full flex-col gap-6 p-8 ${isWide ? '' : 'max-w-[1440px]'}`}>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro
					eyebrow={project?.name ?? ''}
					eyebrowBadge
					title={t('translationsPage.title')}
					description={t('translationsPage.description')}
					titleSize='h2'
				/>
				<div className='flex gap-2'>
					{isAdmin && (
						<Button ref={importButtonRef} variant='default' leftSection={<Upload aria-hidden />} onClick={importModal.open}>
							{t('translationsPage.importButton')}
						</Button>
					)}
					<Button leftSection={<Download aria-hidden />} onClick={exportModal.open}>
						{t('translationsPage.exportButton')}
					</Button>
				</div>
			</div>
			{!isError && (
				<TranslationStats
					stats={isPending ? undefined : (data?.stats ?? { totalKeys: 0, translated: 0, untranslated: 0 })}
					status={search.status}
					onStatusChange={(value) => updateSearch({ status: value })}
				/>
			)}
			{/* The view controls sit close above the card they configure; only the filters inside it stick. */}
			<div className='flex flex-col gap-3'>
				<TranslationsViewControls
					view={view}
					onViewChange={(next) => changePreferences({ translationsView: next })}
					isPreferenceSaving={updatePreferences.isPending}
					layout={layout}
					onLayoutChange={(next) => changePreferences({ translationsLayout: next })}
					languages={languages}
					sourceLanguage={sourceLanguage}
					targetLanguage={targetLanguage}
					shownLanguages={search.languages}
					translationsOnly={search.translationsOnly}
					// The shown languages and Len preklady change only the columns, so the page stays; the pair changes what counts as untranslated.
					onChange={(patch) => updateSearch(patch, { resetPage: !('languages' in patch || 'translationsOnly' in patch) })}
				/>
				<div className={classes.card}>
					<div className={classes.toolbar}>
						<TranslationsToolbar
							search={search.search}
							status={search.status}
							namespace={search.namespace}
							sort={sort}
							updatedBy={search.updatedBy}
							updatedWithin={search.updatedWithin}
							editors={data?.editors ?? []}
							namespaces={data?.namespaces ?? []}
							onChange={(patch) => updateSearch(patch)}
						/>
					</div>
					<TranslationsTable
						projectId={projectId}
						data={data}
						isPending={isPending}
						isError={isError}
						error={languagesQuery.error ?? translationsQuery.error}
						onRetry={retry}
						isRetrying={languagesQuery.isRefetching || translationsQuery.isRefetching}
						view={view}
						layout={layout}
						languages={tableLanguages}
						sourceLanguage={sourceLanguage}
						targetLanguage={targetLanguage}
						onClearFilters={clearFilters}
						onImport={importModal.open}
						showGroups={sort !== 'UPDATED'}
						translationsOnly={search.translationsOnly}
						onSave={saveTranslation}
					/>
				</div>
			</div>
			<VisuallyHidden role='status'>{resultsAnnouncement}</VisuallyHidden>
			<VisuallyHidden role='status'>{savedAnnouncement}</VisuallyHidden>
			{!isError && !isPastEnd && data && data.total > 0 && (
				<TranslationsPagination
					page={page}
					pageSize={pageSize}
					total={data.total}
					shown={data.items.length}
					onChange={(next) => updateSearch({ page: next === 1 ? undefined : next }, { resetPage: false })}
					onPageSizeChange={(next) => updateSearch({ pageSize: next === TRANSLATIONS_PAGE_SIZES[0] ? undefined : next })}
				/>
			)}
			{isAdmin && <ImportModal projectId={projectId} opened={importOpened} onClose={closeImport} />}
			<ExportModal projectId={projectId} opened={exportOpened} onClose={exportModal.close} />
		</div>
	)
}

export default TranslationsPage
