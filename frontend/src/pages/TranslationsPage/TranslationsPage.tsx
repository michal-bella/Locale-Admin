import { Button, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TRANSLATIONS_PAGE_SIZE_DEFAULT, type TranslationsView } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useUpdatePreferencesMutation } from '@/api/profile/useUpdatePreferencesMutation'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { useProjectSettingsQuery } from '@/api/projectSettings/projectSettingsQuery'
import { useTranslationsQuery } from '@/api/translations/translationsQuery'
import { useUpdateTranslationMutation } from '@/api/translations/useUpdateTranslationMutation'
import { Upload } from '@/components/Icons'
import ImportModal from '@/components/ImportModal/ImportModal'
import PageIntro from '@/components/PageIntro/PageIntro'
import TranslationStats from '@/components/TranslationStats/TranslationStats'
import TranslationsPagination from '@/components/TranslationsPagination/TranslationsPagination'
import TranslationsTable from '@/components/TranslationsTable/TranslationsTable'
import TranslationsToolbar from '@/components/TranslationsToolbar/TranslationsToolbar'
import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

import classes from './TranslationsPage.module.css'

const ROUTE_ID = '/_authenticated/_app/projects/$projectSlug/translations'

/**
 * Translations of the project (Figma 3:2): stats, filters in the URL, the table (cells open the edit modal) and pagination. The view is the
 * user's preference (`me.preferences.translationsView`): `EXTENDED` lists every language of the project and the API decides the row status
 * by all of them (no language ids in the query); `COMPACT` is the Figma source → target pair. Without Exportovať, Posledný sync and the
 * Na kontrolu card. Importovať opens `ImportModal`.
 */
const TranslationsPage = () => {
	const { t } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const search = useSearch({ from: ROUTE_ID })
	const navigate = useNavigate({ from: '/projects/$projectSlug/translations' })
	const { data: project } = useProjectSettingsQuery(projectId)
	const { data: me } = useMeQuery()
	const view: TranslationsView = me?.preferences.translationsView ?? 'EXTENDED'
	const updatePreferences = useUpdatePreferencesMutation()
	const languagesQuery = useProjectLanguagesQuery(projectId)
	const languages = languagesQuery.data ?? []
	const [importOpened, importModal] = useDisclosure(false)
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
	const sort = search.sort ?? 'UNTRANSLATED_FIRST'
	const page = search.page ?? 1

	const filters = { search: search.search, status: search.status, namespace: search.namespace, sort, page, pageSize: TRANSLATIONS_PAGE_SIZE_DEFAULT }
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

	const changeView = (next: TranslationsView) =>
		updatePreferences.mutate(
			{ translationsView: next },
			{ onError: (error) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) }) },
		)

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

	const clearFilters = () => updateSearch({ search: undefined, status: undefined, namespace: undefined })

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

	return (
		<div className='mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro
					eyebrow={project?.name ?? ''}
					eyebrowBadge
					title={t('translationsPage.title')}
					description={t('translationsPage.description')}
					titleSize='h2'
				/>
				<Button ref={importButtonRef} variant='default' leftSection={<Upload aria-hidden />} onClick={importModal.open}>
					{t('translationsPage.importButton')}
				</Button>
			</div>
			{!isError && <TranslationStats stats={isPending ? undefined : (data?.stats ?? { totalKeys: 0, translated: 0, untranslated: 0 })} />}
			<div className={classes.card}>
				<div className={classes.toolbar}>
					<TranslationsToolbar
						search={search.search}
						status={search.status}
						namespace={search.namespace}
						sort={sort}
						view={view}
						onViewChange={changeView}
						isViewSaving={updatePreferences.isPending}
						languages={languages}
						sourceLanguage={sourceLanguage}
						targetLanguage={targetLanguage}
						namespaces={data?.namespaces ?? []}
						onChange={updateSearch}
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
					languages={languages}
					sourceLanguage={sourceLanguage}
					targetLanguage={targetLanguage}
					onClearFilters={clearFilters}
					onImport={importModal.open}
					showGroups={sort !== 'UPDATED'}
					onSave={saveTranslation}
				/>
			</div>
			<VisuallyHidden role='status'>{resultsAnnouncement}</VisuallyHidden>
			<VisuallyHidden role='status'>{savedAnnouncement}</VisuallyHidden>
			{!isError && !isPastEnd && data && data.total > 0 && (
				<TranslationsPagination
					page={page}
					pageSize={data.pageSize}
					total={data.total}
					shown={data.items.length}
					onChange={(next) => updateSearch({ page: next === 1 ? undefined : next }, { resetPage: false })}
				/>
			)}
			<ImportModal projectId={projectId} opened={importOpened} onClose={closeImport} />
		</div>
	)
}

export default TranslationsPage
