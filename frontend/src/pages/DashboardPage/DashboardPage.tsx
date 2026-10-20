import { Button, Text } from '@mantine/core'
import { Link, useLoaderData, useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useDashboardQuery } from '@/api/dashboard/dashboardQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { useProjectMembersQuery } from '@/api/projectMembers/projectMembersQuery'
import { useProjectSettingsQuery } from '@/api/projectSettings/projectSettingsQuery'
import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import ActivityFeed from '@/components/ActivityFeed/ActivityFeed'
import DailyActivity from '@/components/DailyActivity/DailyActivity'
import { ArrowRight, Check, Globe, Key, Users } from '@/components/Icons'
import LanguageStatus from '@/components/LanguageStatus/LanguageStatus'
import PageIntro from '@/components/PageIntro/PageIntro'
import StatCard from '@/components/StatCard/StatCard'
import { formatShare } from '@/lib/formatShare'

import classes from './DashboardPage.module.css'

/**
 * Prehľad of the project (Figma 3:475) without Importovať and Exportovať: the stat cards, Stav jazykov, Posledná aktivita and Denná aktivita.
 * Languages and members come from their own queries (shared with their pages), the key counts from the dashboard endpoint.
 */
const DashboardPage = () => {
	const { t, i18n } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { projectSlug } = useParams({ from: '/_authenticated/_app/projects/$projectSlug/dashboard' })
	const { data: project } = useProjectSettingsQuery(projectId)
	const dashboardQuery = useDashboardQuery(projectId)
	const languagesQuery = useProjectLanguagesQuery(projectId)
	const membersQuery = useProjectMembersQuery(projectId)
	const dashboard = dashboardQuery.data
	const languages = languagesQuery.data
	const members = membersQuery.data?.members
	const statsQueries = [dashboardQuery, languagesQuery, membersQuery]
	const failedStats = statsQueries.find((query) => query.isError)

	const share = (part: number, total: number) => {
		const { percent, bound } = formatShare(part, total, i18n.language)
		return bound ? t(`dashboardPage.${bound}`, { percent }) : percent
	}

	const retryStats = () => statsQueries.filter((query) => query.isError).forEach((query) => void query.refetch())

	return (
		<div className='mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('dashboardPage.eyebrow')} title={project?.name ?? ''} description={t('dashboardPage.description')} titleSize='h2' />
				<ButtonLink to='/projects/$projectSlug/translations' params={{ projectSlug }} rightSection={<ArrowRight aria-hidden />}>
					{t('dashboardPage.openTranslations')}
				</ButtonLink>
			</div>
			{failedStats ? (
				<div role='alert' className={`${classes.empty} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('dashboardPage.stats.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(failedStats.error)}`)}</Text>
					<Button variant='default' mt='md' loading={statsQueries.some((query) => query.isRefetching)} onClick={retryStats}>
						{t('dashboardPage.stats.retry')}
					</Button>
				</div>
			) : (
				<section
					aria-label={t('dashboardPage.stats.label')}
					aria-busy={!dashboard || !languages || !members}
					className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'
				>
					<StatCard
						label={t('dashboardPage.stats.keys')}
						value={dashboard?.keys.total}
						hint={dashboard && t('dashboardPage.stats.keysCreated', { count: dashboard.keys.createdLast30Days })}
						icon={Key}
						tone='brand'
					/>
					<StatCard
						label={t('dashboardPage.stats.translated')}
						value={dashboard && share(dashboard.translatedKeys, dashboard.keys.total)}
						hint={dashboard && t('dashboardPage.stats.translatedOf', { translated: dashboard.translatedKeys, count: dashboard.keys.total })}
						icon={Check}
						tone='brand'
						link={{
							label: t('dashboardPage.stats.showUntranslated'),
							to: '/projects/$projectSlug/translations',
							params: { projectSlug },
							search: { status: 'UNTRANSLATED' },
						}}
					/>
					<StatCard
						label={t('dashboardPage.stats.languages')}
						value={languages?.length}
						hint={languages?.some((language) => language.isBase) ? t('dashboardPage.stats.baseLanguage') : undefined}
						icon={Globe}
						tone='brand'
					/>
					<StatCard
						label={t('dashboardPage.stats.members')}
						value={members?.length}
						hint={members && t('dashboardPage.stats.admins', { count: members.filter((member) => member.role === ROLE.ADMIN).length })}
						icon={Users}
						tone='brand'
						link={{ label: t('dashboardPage.stats.showMembers'), to: '/projects/$projectSlug/members', params: { projectSlug } }}
					/>
				</section>
			)}
			{dashboard?.keys.total === 0 && (
				<div className={`${classes.empty} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('dashboardPage.empty.title')}
					</Text>
					<Text size='xs'>{t('dashboardPage.empty.description')}</Text>
					<Link to='/projects/$projectSlug/translations' params={{ projectSlug }} className={`${classes.link} mt-2`}>
						{t('dashboardPage.empty.link')}
					</Link>
				</div>
			)}
			<div className='grid grid-cols-1 gap-5 lg:grid-cols-[11fr_9fr]'>
				<LanguageStatus projectId={projectId} projectSlug={projectSlug} />
				<ActivityFeed projectId={projectId} projectSlug={projectSlug} />
			</div>
			<DailyActivity projectId={projectId} />
		</div>
	)
}

export default DashboardPage
