import { Select, Switch } from '@mantine/core'
import { useLoaderData, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ACTIVITY_CATEGORIES, ACTIVITY_RANGE_DAYS, ACTIVITY_RANGES, activityCategorySchema, activityRangeSchema } from '@locale/shared'

import { useActivityListQuery } from '@/api/activity/activityQuery'
import { useMeQuery } from '@/api/auth/meQuery'
import { useProjectVersionsQuery } from '@/api/projectVersions/projectVersionsQuery'
import ActivityHistoryTable from '@/components/ActivityHistoryTable/ActivityHistoryTable'
import { Clock, LayoutGrid, Tag, User } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'
import TranslationsPagination from '@/components/TranslationsPagination/TranslationsPagination'
import { HISTORY_PAGE_SIZES, type HistoryPageSize, type HistorySearch } from '@/routes/projectHistoryRoute'

import classes from './HistoryPage.module.css'

const ALL_TIME = 'ALL'

/** História of the project: every event in a table with numbered pages, filtered by person, type, version and period (all kept in the URL). */
const HistoryPage = () => {
	const { t } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { projectSlug } = useParams({ from: '/_authenticated/_app/projects/$projectSlug' })
	const search = useSearch({ from: '/_authenticated/_app/projects/$projectSlug/history' })
	const navigate = useNavigate({ from: '/projects/$projectSlug/history' })
	const page = search.page ?? 1
	const pageSize = search.pageSize ?? HISTORY_PAGE_SIZES[0]
	const query = useActivityListQuery(projectId, {
		userId: search.user,
		category: search.category,
		versionId: search.version,
		// The last N local days with today, so „Posledných 7 dní“ means the same as the 7 days of Denná aktivita.
		from:
			search.period &&
			dayjs()
				.startOf('day')
				.subtract(ACTIVITY_RANGE_DAYS[search.period] - 1, 'day')
				.toISOString(),
		page,
		pageSize,
	})
	const { data: versions } = useProjectVersionsQuery(projectId)
	const { data: me } = useMeQuery()
	const data = query.data
	const filtered = Boolean(search.user || search.category || search.version || search.period)

	const updateSearch = (patch: Partial<HistorySearch>, { resetPage = true } = {}) =>
		void navigate({ search: (previous) => ({ ...previous, ...patch, ...(resetPage ? { page: undefined } : {}) }), replace: true })

	const users = data?.users ?? []
	// Len moje zmeny sets the person filter to the signed-in user, who may have no change yet and so be missing from `users`.
	const userOptions = [
		...users.map((user) => ({ value: user.id, label: user.name })),
		...(me && search.user === me.id && !users.some((user) => user.id === me.id)
			? [{ value: me.id, label: [me.firstName, me.lastName].filter(Boolean).join(' ') || me.email }]
			: []),
	]

	const resetFilters = () => updateSearch({ user: undefined, category: undefined, version: undefined, period: undefined })

	// A page past the end (shared link, or a narrower filter) goes to the last page instead of showing "no results".
	const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
	const isPastEnd = !query.isPlaceholderData && data !== undefined && data.total > 0 && data.items.length === 0 && page > lastPage
	useEffect(() => {
		if (isPastEnd) {
			void navigate({ search: (previous) => ({ ...previous, page: lastPage === 1 ? undefined : lastPage }), replace: true })
		}
	}, [isPastEnd, lastPage, navigate])

	return (
		<div className='mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-8'>
			<PageIntro eyebrow={t('historyPage.eyebrow')} title={t('historyPage.title')} description={t('historyPage.description')} titleSize='h2' />
			<div role='group' aria-label={t('historyPage.filters.label')} className={classes.filters}>
				<Select
					aria-label={t('historyPage.filters.user.label')}
					placeholder={t('historyPage.filters.user.placeholder')}
					className={classes.select}
					leftSection={<User aria-hidden />}
					data={userOptions}
					value={search.user ?? null}
					onChange={(value) => updateSearch({ user: value ?? undefined })}
					searchable
					clearable
				/>
				<Select
					aria-label={t('historyPage.filters.category.label')}
					placeholder={t('historyPage.filters.category.placeholder')}
					className={classes.select}
					leftSection={<LayoutGrid aria-hidden />}
					data={ACTIVITY_CATEGORIES.map((category) => ({ value: category, label: t(`historyPage.categories.${category}`) }))}
					value={search.category ?? null}
					onChange={(value) => {
						const parsed = activityCategorySchema.safeParse(value)
						updateSearch({ category: parsed.success ? parsed.data : undefined })
					}}
					clearable
				/>
				{versions && versions.items.length > 0 && (
					<Select
						aria-label={t('historyPage.filters.version.label')}
						placeholder={t('historyPage.filters.version.placeholder')}
						className={classes.select}
						leftSection={<Tag width={16} height={16} aria-hidden />}
						data={versions.items.map((item) => ({
							value: item.id,
							label: item.isCurrent ? t('dashboardPage.version.current', { name: item.name }) : item.name,
						}))}
						value={search.version ?? null}
						onChange={(value) => updateSearch({ version: value ?? undefined })}
						clearable
					/>
				)}
				<Select
					aria-label={t('historyPage.filters.period.label')}
					className={classes.select}
					leftSection={<Clock aria-hidden />}
					data={[
						{ value: ALL_TIME, label: t('historyPage.filters.period.all') },
						...ACTIVITY_RANGES.map((range) => ({
							value: range,
							label: t('historyPage.filters.period.last', { count: ACTIVITY_RANGE_DAYS[range] }),
						})),
					]}
					value={search.period ?? ALL_TIME}
					onChange={(value) => {
						const parsed = activityRangeSchema.safeParse(value)
						updateSearch({ period: parsed.success ? parsed.data : undefined })
					}}
					allowDeselect={false}
				/>
				{me && (
					<Switch
						label={t('historyPage.filters.mine')}
						className={classes.mine}
						classNames={{ track: classes.pointer, label: classes.pointer }}
						checked={search.user === me.id}
						onChange={(event) => updateSearch({ user: event.currentTarget.checked ? me.id : undefined })}
					/>
				)}
			</div>
			<ActivityHistoryTable
				projectSlug={projectSlug}
				events={data?.items}
				error={query.isError ? query.error : null}
				isRefetching={query.isRefetching}
				onRetry={() => void query.refetch()}
				filtered={filtered}
				onResetFilters={resetFilters}
			/>
			{data && data.total > 0 && (
				<TranslationsPagination<HistoryPageSize>
					page={page}
					pageSize={pageSize}
					total={data.total}
					shown={data.items.length}
					onChange={(next) => updateSearch({ page: next === 1 ? undefined : next }, { resetPage: false })}
					onPageSizeChange={(next) => updateSearch({ pageSize: next === HISTORY_PAGE_SIZES[0] ? undefined : next })}
					pageSizes={HISTORY_PAGE_SIZES}
					summary={t('historyPage.pagination.summary', { shown: data.items.length, count: data.total })}
					pageSizeLabel={t('historyPage.pagination.pageSize')}
				/>
			)}
		</div>
	)
}

export default HistoryPage
