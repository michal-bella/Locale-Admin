import { Button, Select } from '@mantine/core'
import { type DateFormatter, DatePickerInput, DatesProvider } from '@mantine/dates'
import { useLoaderData, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ACTIVITY_CATEGORIES, activityCategorySchema } from '@locale/shared'

import { useActivityListQuery } from '@/api/activity/activityQuery'
import { useProjectVersionsQuery } from '@/api/projectVersions/projectVersionsQuery'
import ActivityHistoryTable from '@/components/ActivityHistoryTable/ActivityHistoryTable'
import { Clock, LayoutGrid, Tag, User } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'
import TranslationsPagination from '@/components/TranslationsPagination/TranslationsPagination'
import { toDayjsLocale } from '@/lib/dateInput'
import { formatDate } from '@/lib/formatDate'
import { HISTORY_PAGE_SIZES, type HistoryPageSize, type HistorySearch } from '@/routes/projectHistoryRoute'

import classes from './HistoryPage.module.css'

const PERIOD_PRESET_DAYS = [7, 30, 90] as const

/** Start of the local day `date` (`YYYY-MM-DD`) plus `days`, as the UTC instant the API filters `createdAt` by. */
const startOfDay = (date: string, days = 0) => dayjs(date).add(days, 'day').toDate().toISOString()

/** História of the project: every event in a table with numbered pages, filtered by person, type, version and period (all kept in the URL). */
const HistoryPage = () => {
	const { t, i18n } = useTranslation()
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
		from: search.from && startOfDay(search.from),
		// `to` is the last day shown, the API bound is exclusive.
		to: search.to && startOfDay(search.to, 1),
		page,
		pageSize,
	})
	const { data: versions } = useProjectVersionsQuery(projectId)
	const data = query.data
	const filtered = Boolean(search.user || search.category || search.version || search.from || search.to)

	const updateSearch = (patch: Partial<HistorySearch>, { resetPage = true } = {}) =>
		void navigate({ search: (previous) => ({ ...previous, ...patch, ...(resetPage ? { page: undefined } : {}) }), replace: true })

	const resetFilters = () => updateSearch({ user: undefined, category: undefined, version: undefined, from: undefined, to: undefined })

	// A page past the end (shared link, or a narrower filter) goes to the last page instead of showing "no results".
	const lastPage = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
	const isPastEnd = !query.isPlaceholderData && data !== undefined && data.total > 0 && data.items.length === 0 && page > lastPage
	useEffect(() => {
		if (isPastEnd) {
			void navigate({ search: (previous) => ({ ...previous, page: lastPage === 1 ? undefined : lastPage }), replace: true })
		}
	}, [isPastEnd, lastPage, navigate])

	const today = dayjs().format('YYYY-MM-DD')
	const periodPresets = PERIOD_PRESET_DAYS.map((days) => ({
		value: [
			dayjs()
				.subtract(days - 1, 'day')
				.format('YYYY-MM-DD'),
			today,
		] as [string, string],
		label: t('historyPage.filters.period.last', { count: days }),
	}))
	const formatPeriod: DateFormatter = ({ date }) =>
		Array.isArray(date)
			? date
					.filter((value) => value !== null)
					.map((value) => formatDate(dayjs(value).format('YYYY-MM-DD'), i18n.language))
					.join(' – ')
			: ''

	return (
		<div className='mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-8'>
			<PageIntro eyebrow={t('historyPage.eyebrow')} title={t('historyPage.title')} description={t('historyPage.description')} titleSize='h2' />
			<div role='group' aria-label={t('historyPage.filters.label')} className={classes.filters}>
				<Select
					aria-label={t('historyPage.filters.user.label')}
					placeholder={t('historyPage.filters.user.placeholder')}
					className={classes.select}
					leftSection={<User aria-hidden />}
					data={(data?.users ?? []).map((user) => ({ value: user.id, label: user.name }))}
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
				<DatesProvider settings={{ locale: toDayjsLocale(i18n.language) }}>
					<DatePickerInput
						type='range'
						aria-label={t('historyPage.filters.period.label')}
						placeholder={t('historyPage.filters.period.placeholder')}
						className={classes.period}
						leftSection={<Clock aria-hidden />}
						value={[search.from ?? null, search.to ?? null]}
						onChange={([from, to]) => {
							// The first click picks only the start; the filter changes once the range is whole (or cleared).
							if ((from === null) === (to === null)) {
								updateSearch({ from: from ?? undefined, to: to ?? undefined })
							}
						}}
						valueFormatter={formatPeriod}
						presets={periodPresets}
						maxDate={today}
						allowSingleDateInRange
						clearable
						highlightToday
					/>
				</DatesProvider>
				{filtered && (
					<Button variant='subtle' onClick={resetFilters}>
						{t('historyPage.filters.reset')}
					</Button>
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
