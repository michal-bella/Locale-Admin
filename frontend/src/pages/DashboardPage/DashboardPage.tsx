import { Button, Select, Text } from '@mantine/core'
import { Link, useLoaderData, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { useDashboardQuery } from '@/api/dashboard/dashboardQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import { useProjectMembersQuery } from '@/api/projectMembers/projectMembersQuery'
import { useProjectSettingsQuery } from '@/api/projectSettings/projectSettingsQuery'
import { useProjectVersionsQuery } from '@/api/projectVersions/projectVersionsQuery'
import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import ActivityFeed from '@/components/ActivityFeed/ActivityFeed'
import DailyActivity from '@/components/DailyActivity/DailyActivity'
import { ArrowRight, Check, Globe, Key, LayoutGrid, Tag, Users } from '@/components/Icons'
import LanguageStatus from '@/components/LanguageStatus/LanguageStatus'
import PageIntro from '@/components/PageIntro/PageIntro'
import StatCard from '@/components/StatCard/StatCard'
import { formatShare } from '@/lib/formatShare'

import classes from './DashboardPage.module.css'

/**
 * Prehľad of the project (Figma 3:475) without Importovať and Exportovať: the stat cards, Stav jazykov, Posledná aktivita and Denná aktivita.
 * Languages and members come from their own queries (shared with their pages), the key counts from the dashboard endpoint. The numbers and
 * the daily activity are per version: the select in the header starts on the version the backend answered with (the current one).
 */
const DashboardPage = () => {
	const { t, i18n } = useTranslation()
	const { projectId } = useLoaderData({ from: '/_authenticated/_app/projects/$projectSlug' })
	const { projectSlug } = useParams({ from: '/_authenticated/_app/projects/$projectSlug/dashboard' })
	const { data: me } = useMeQuery()
	// A VISITOR cannot open Jazyky, Verzie and Členovia (403), so the links there are not shown.
	const canManageProject = me?.role !== ROLE.VISITOR
	const { data: project } = useProjectSettingsQuery(projectId)
	const versionsQuery = useProjectVersionsQuery(projectId)
	const versions = versionsQuery.data
	const [chosenVersionId, setChosenVersionId] = useState<string>()
	const dashboardQuery = useDashboardQuery(projectId, { versionId: chosenVersionId })
	const languagesQuery = useProjectLanguagesQuery(projectId)
	const membersQuery = useProjectMembersQuery(projectId)
	const dashboard = dashboardQuery.data
	const languages = languagesQuery.data
	const members = membersQuery.data?.members
	const currentVersion = versions?.items.find((item) => item.isCurrent)
	const versionId = chosenVersionId ?? dashboard?.version?.id
	const statsQueries = [dashboardQuery, languagesQuery, membersQuery, versionsQuery]
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
				<div className='flex flex-wrap items-center gap-3'>
					{versions && versions.items.length > 0 && (
						<Select
							aria-label={t('dashboardPage.version.label')}
							className={classes.versionSelect}
							leftSection={<Tag width={16} height={16} aria-hidden />}
							data={versions.items.map((item) => ({
								value: item.id,
								label: item.isCurrent ? t('dashboardPage.version.current', { name: item.name }) : item.name,
							}))}
							value={versionId ?? null}
							onChange={(value) => setChosenVersionId(value ?? undefined)}
							allowDeselect={false}
						/>
					)}
					<ButtonLink to='/projects/$projectSlug/translations' params={{ projectSlug }} rightSection={<ArrowRight aria-hidden />}>
						{t('dashboardPage.openTranslations')}
					</ButtonLink>
				</div>
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
					aria-busy={!dashboard || !languages || !members || !versions}
					className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'
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
						value={dashboard?.translatedKeys}
						format={(translated) => share(translated, dashboard?.keys.total ?? 0)}
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
						label={t('dashboardPage.stats.strings')}
						value={dashboard?.strings.filled}
						format={(filled) => share(filled, dashboard?.strings.total ?? 0)}
						hint={dashboard && t('dashboardPage.stats.stringsOf', { filled: dashboard.strings.filled, count: dashboard.strings.total })}
						icon={LayoutGrid}
						tone='brand'
					/>
					<StatCard
						label={t('dashboardPage.stats.versions')}
						value={versions?.items.length}
						hint={currentVersion && t('dashboardPage.stats.versionsCurrent', { name: currentVersion.name })}
						icon={Tag}
						tone='brand'
						link={
							canManageProject
								? { label: t('dashboardPage.stats.showVersions'), to: '/projects/$projectSlug/versions', params: { projectSlug } }
								: undefined
						}
					/>
					<StatCard
						label={t('dashboardPage.stats.languages')}
						value={languages?.length}
						hint={languages?.some((language) => language.isBase) ? t('dashboardPage.stats.baseLanguage') : undefined}
						icon={Globe}
						tone='brand'
						link={
							canManageProject
								? { label: t('dashboardPage.stats.showLanguages'), to: '/projects/$projectSlug/languages', params: { projectSlug } }
								: undefined
						}
					/>
					<StatCard
						label={t('dashboardPage.stats.members')}
						value={members?.length}
						hint={members && t('dashboardPage.stats.admins', { count: members.filter((member) => member.role === ROLE.ADMIN).length })}
						icon={Users}
						tone='brand'
						link={
							canManageProject
								? { label: t('dashboardPage.stats.showMembers'), to: '/projects/$projectSlug/members', params: { projectSlug } }
								: undefined
						}
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
				<LanguageStatus projectId={projectId} projectSlug={projectSlug} manageable={canManageProject} />
				<ActivityFeed projectId={projectId} projectSlug={projectSlug} />
			</div>
			<DailyActivity projectId={projectId} versionId={chosenVersionId} />
		</div>
	)
}

export default DashboardPage
