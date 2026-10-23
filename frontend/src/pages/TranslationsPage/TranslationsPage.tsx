import { Button, Text, VisuallyHidden } from '@mantine/core'
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
import { useProjectVersionsQuery } from '@/api/projectVersions/projectVersionsQuery'
import { useVersionDiffQuery } from '@/api/projectVersions/versionDiffQuery'
import { useTranslationsQuery } from '@/api/translations/translationsQuery'
import { useUpdateTranslationMutation } from '@/api/translations/useUpdateTranslationMutation'
import CreateKeyModal from '@/components/CreateKeyModal/CreateKeyModal'
import ExportModal from '@/components/ExportModal/ExportModal'
import { Download, Plus, Tag, Upload } from '@/components/Icons'
import ImportModal from '@/components/ImportModal/ImportModal'
import PageIntro from '@/components/PageIntro/PageIntro'
import TranslationStats from '@/components/TranslationStats/TranslationStats'
import TranslationsPagination from '@/components/TranslationsPagination/TranslationsPagination'
import TranslationsTable from '@/components/TranslationsTable/TranslationsTable'
import TranslationsToolbar from '@/components/TranslationsToolbar/TranslationsToolbar'
import TranslationsVersionBanner from '@/components/TranslationsVersionBanner/TranslationsVersionBanner'
import TranslationsViewControls from '@/components/TranslationsViewControls/TranslationsViewControls'
import TranslationsWarningsBanner from '@/components/TranslationsWarningsBanner/TranslationsWarningsBanner'
import VersionFormModal from '@/components/VersionFormModal/VersionFormModal'
import VersionLockModal from '@/components/VersionLockModal/VersionLockModal'
import { TRANSLATIONS_PAGE_SIZES, type TranslationsSearch } from '@/routes/projectTranslationsRoute'

import classes from './TranslationsPage.module.css'

const ROUTE_ID = '/_authenticated/_app/projects/$projectSlug/translations'

/**
 * Translations of the project (Figma 3:2): stats, filters in the URL, the table (cells open the edit modal) and pagination. The view is the
 * user's preference (`me.preferences.translationsView`): `EXTENDED` lists every language of the project and the API decides the row status
 * by all of them (no language ids in the query); `?languages=` narrows its columns to the base language plus the chosen ones without changing
 * the row status. `COMPACT` is the Figma source → target pair. Either view lays its languages side by side or stacked, also a preference
 * (`me.preferences.translationsLayout`). Without Posledný sync and the Na kontrolu card. Importovať (ADMIN only) opens `ImportModal`, Exportovať (every member) `ExportModal`.
 * A VISITOR gets the table read-only: cells are text and there is no edit modal. The list always shows one version of the project
 * (`?version=`, else the current one, else the newest); a project without versions, or a version without import, gets an empty state
 * instead of the table. Zobraziť len zmeny (`?diff=true`) lists only the keys added or changed against the previous version, with the
 * added keys and changed cells marked, and the banner sums the diff up. An ADMIN also creates a version here (the page then shows it)
 * and locks or unlocks the version of the banner.
 */
const TranslationsPage = () => {
	const { t } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const search = useSearch({ from: ROUTE_ID })
	const navigate = useNavigate({ from: '/projects/$projectSlug/translations' })
	const { data: project } = useProjectSettingsQuery(projectId)
	const { data: me } = useMeQuery()
	const isAdmin = me?.role === ROLE.ADMIN
	const isVisitor = me?.role === ROLE.VISITOR
	const view: TranslationsView = me?.preferences.translationsView ?? 'EXTENDED'
	const layout: TranslationsLayout = me?.preferences.translationsLayout ?? 'COLUMNS'
	const updatePreferences = useUpdatePreferencesMutation()
	const languagesQuery = useProjectLanguagesQuery(projectId)
	const languages = languagesQuery.data ?? []
	const versionsQuery = useProjectVersionsQuery(projectId)
	const versions = versionsQuery.data?.items ?? []
	// Every version holds its own copy of the keys, so the list always shows one: the one in the URL, else the current one, else the newest.
	const version = versions.find((item) => item.id === search.version) ?? versions.find((item) => item.isCurrent) ?? versions[0]
	const versionId = version?.id
	// A version is filled only by an import; until then there is nothing to list, and the API refuses Pridať kľúč (409 PROJECT_VERSION_EMPTY).
	const versionHasImport = version !== undefined && version.importedAt !== null
	// An editor cannot write into a locked version; the API would refuse it (409), so the cells do not open at all.
	const writesBlocked = !isAdmin && version?.isLocked === true
	const [importOpened, importModal] = useDisclosure(false)
	const [exportOpened, exportModal] = useDisclosure(false)
	const [createKeyOpened, createKeyModal] = useDisclosure(false)
	const [createVersionOpened, createVersionModal] = useDisclosure(false)
	const [lockVersionOpened, lockVersionModal] = useDisclosure(false)
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
		warnings: search.warnings,
		diff: search.diff,
		versionId,
		sort,
		page,
		pageSize,
	}
	const listQuery =
		sourceLanguage && targetLanguage && versionHasImport
			? view === 'COMPACT'
				? { sourceLanguageId: sourceLanguage.id, targetLanguageId: targetLanguage.id, ...filters }
				: filters
			: null
	const translationsQuery = useTranslationsQuery(projectId, listQuery)
	const data = translationsQuery.data
	// The banner says how many keys of the version are still untranslated whatever the filters are (one key is enough, the total is what counts).
	const untranslatedQuery = useTranslationsQuery(
		projectId,
		version && listQuery
			? {
					...(view === 'COMPACT' && sourceLanguage && targetLanguage
						? { sourceLanguageId: sourceLanguage.id, targetLanguageId: targetLanguage.id }
						: {}),
					versionId: version.id,
					status: 'UNTRANSLATED',
					pageSize: 1,
				}
			: null,
	)
	const diffQuery = useVersionDiffQuery(projectId, versionHasImport ? version.id : null)
	const namespaces = data?.namespaces ?? []
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

	const clearFilters = () =>
		updateSearch({
			search: undefined,
			status: undefined,
			namespace: undefined,
			updatedBy: undefined,
			updatedWithin: undefined,
			warnings: undefined,
			diff: undefined,
		})

	const retry = async () => {
		const languagesResult = languagesQuery.isError ? await languagesQuery.refetch() : languagesQuery
		const versionsResult = versionsQuery.isError ? await versionsQuery.refetch() : versionsQuery
		if (languagesResult.isError || versionsResult.isError) {
			return false
		}
		const translationsResult = translationsQuery.isError ? await translationsQuery.refetch() : translationsQuery
		return !translationsResult.isError
	}

	const isError = languagesQuery.isError || versionsQuery.isError || translationsQuery.isError
	const isPending = !isError && (languagesQuery.isPending || versionsQuery.isPending || (listQuery !== null && translationsQuery.isPending) || isPastEnd)
	const hasNoVersions = !isError && !isPending && versions.length === 0
	const isVersionEmpty = !isError && !isPending && version !== undefined && !versionHasImport

	// The search commits 300 ms after typing and the table changes silently; one polite region says what the list shows now.
	const resultsAnnouncement = (() => {
		if (isPending || isError) {
			return ''
		}
		if (isVersionEmpty) {
			return t('translationsPage.versionEmpty', { name: version.name })
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
				<div className='flex flex-wrap gap-2 max-sm:w-full max-sm:flex-col'>
					{isAdmin && (
						<Button variant='default' leftSection={<Tag aria-hidden />} onClick={createVersionModal.open}>
							{t('translationsPage.createVersionButton')}
						</Button>
					)}
					{/* A key goes into an existing namespace, so a project without keys starts with an import. */}
					{isAdmin && versionHasImport && namespaces.length > 0 && (
						<Button variant='default' leftSection={<Plus aria-hidden />} onClick={createKeyModal.open}>
							{t('translationsPage.createKeyButton')}
						</Button>
					)}
					{isAdmin && version && (
						<Button ref={importButtonRef} variant='default' leftSection={<Upload aria-hidden />} onClick={importModal.open}>
							{t('translationsPage.importButton')}
						</Button>
					)}
					{version && (
						<Button leftSection={<Download aria-hidden />} onClick={exportModal.open}>
							{t('translationsPage.exportButton')}
						</Button>
					)}
				</div>
			</div>
			{!isError && (
				<TranslationStats
					language={view === 'COMPACT' ? targetLanguage : undefined}
					stats={isPending ? undefined : (data?.stats ?? { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0, untranslatedByLanguage: {} })}
					status={search.status}
					// The cards count every key of the version, so a card drops the other row filters to show exactly its number.
					onStatusChange={(value) =>
						updateSearch({
							search: undefined,
							namespace: undefined,
							updatedBy: undefined,
							updatedWithin: undefined,
							warnings: undefined,
							diff: undefined,
							status: value,
						})
					}
				/>
			)}
			{!isError && !isPending && version && (
				<TranslationsVersionBanner
					version={version}
					writesBlocked={!isAdmin && version.isLocked}
					untranslated={untranslatedQuery.data?.total}
					language={view === 'COMPACT' ? targetLanguage : undefined}
					diff={diffQuery.data}
					onToggleLock={isAdmin ? lockVersionModal.open : undefined}
				/>
			)}
			{!isError && !isPending && data && (data.stats.warnings > 0 || search.warnings) && (
				<TranslationsWarningsBanner
					count={data.stats.warnings}
					active={search.warnings === true}
					// The banner counts the whole version, so the list drops the diff filter to show exactly those keys. A warning can be in any
					// language, so the list also shows every one: the extended view without a language selection.
					onShow={() => {
						if (view === 'COMPACT') {
							changePreferences({ translationsView: 'EXTENDED' })
						}
						updateSearch({ warnings: true, diff: undefined, languages: undefined })
					}}
					onClear={() => updateSearch({ warnings: undefined })}
				/>
			)}
			{hasNoVersions ? (
				<Text component='p' className={`${classes.card} p-8`}>
					{t('translationsPage.noVersions')}
				</Text>
			) : (
				/* The view controls sit close above the card they configure; only the filters inside it stick. */
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
						// The shown languages and Len preklady change only the columns, so the page stays; the pair changes what counts as untranslated.
						onChange={(patch) => updateSearch(patch, { resetPage: !('languages' in patch) })}
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
								version={versionId}
								versions={versions}
								editors={data?.editors ?? []}
								namespaces={namespaces}
								translationsOnly={search.translationsOnly}
								diffOnly={search.diff}
								diffAvailable={versionHasImport}
								// Len preklady changes only the columns, so the page stays.
								onChange={(patch) => updateSearch(patch, { resetPage: !('translationsOnly' in patch) })}
							/>
						</div>
						{/* The toolbar stays, so the Verzia select still leads out of an empty version; only the table gives way to the empty state. */}
						{isVersionEmpty ? (
							<div className='flex flex-col items-center gap-4 px-5 py-10 text-center'>
								<Text component='p' size='sm'>
									{t('translationsPage.versionEmpty', { name: version.name })}
								</Text>
								{isAdmin && (
									<Button variant='default' leftSection={<Upload aria-hidden />} onClick={importModal.open}>
										{t('translationsPage.importButton')}
									</Button>
								)}
							</div>
						) : (
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
								readOnly={isVisitor || writesBlocked}
								onSave={saveTranslation}
							/>
						)}
					</div>
				</div>
			)}
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
			{isAdmin && version && (
				<ImportModal projectId={projectId} versions={versions} defaultVersionId={version.id} opened={importOpened} onClose={closeImport} />
			)}
			{isAdmin && (
				<VersionFormModal
					projectId={projectId}
					opened={createVersionOpened}
					version={null}
					onClose={createVersionModal.close}
					// The new version is what the user works in next, so the list filters by it right away.
					onCreated={(created) => updateSearch({ version: created.id })}
				/>
			)}
			{isAdmin && <VersionLockModal projectId={projectId} opened={lockVersionOpened} version={version ?? null} onClose={lockVersionModal.close} />}
			{isAdmin && version && (
				<CreateKeyModal
					projectId={projectId}
					languages={languages}
					namespaces={namespaces}
					defaultNamespace={search.namespace}
					versionId={version.id}
					opened={createKeyOpened}
					onClose={createKeyModal.close}
					// Shows the new key whatever page or filters were on; an empty namespace means no namespace filter.
					onCreated={(key) =>
						updateSearch({
							search: key.name,
							namespace: key.namespace || undefined,
							status: undefined,
							updatedBy: undefined,
							updatedWithin: undefined,
							warnings: undefined,
						})
					}
				/>
			)}
			{version && <ExportModal projectId={projectId} version={version} opened={exportOpened} onClose={exportModal.close} />}
		</div>
	)
}

export default TranslationsPage
