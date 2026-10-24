import { Button, Progress, Skeleton, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { type LanguageListItem } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectLanguagesQuery } from '@/api/projectLanguages/projectLanguagesQuery'
import CountUp from '@/atoms/CountUp/CountUp'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import SectionCard from '@/components/SectionCard/SectionCard'
import { formatShare } from '@/lib/formatShare'

import classes from './LanguageStatus.module.css'
import { type LanguageStatusProps } from './types'

const SKELETON_ROWS = 3

/**
 * Stav jazykov of Figma 3:596: every language of the project in project order with its translated share. A row other than the base
 * opens Preklady with that language's untranslated keys: `target` for the compact view, `languages` for the extended one.
 */
const LanguageStatus = ({ projectId, projectSlug, manageable }: LanguageStatusProps) => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectLanguagesQuery(projectId)

	const languageName = (language: LanguageListItem) => {
		const name = t(`languageNames.${language.tag}`)
		return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1)
	}

	const share = (part: number, total: number) => {
		const { percent, bound } = formatShare(part, total, i18n.language)
		return bound ? t(`dashboardPage.${bound}`, { percent }) : percent
	}

	const renderRow = (language: LanguageListItem) => {
		const name = languageName(language)
		const percent = share(language.translatedCount, language.keyCount)
		const content = (
			<>
				<div className='flex items-center gap-3'>
					<LanguageFlag code={language.flagCode} size='md' />
					<div className='flex min-w-0 flex-1 flex-col'>
						<div className='flex items-start justify-between gap-3'>
							<span className={classes.name}>{name}</span>
							<span className={classes.percent}>
								<CountUp value={language.translatedCount} format={(translated) => share(translated, language.keyCount)} />
							</span>
						</div>
						<span className={classes.meta}>
							{language.isBase
								? t('dashboardPage.languages.base')
								: t('dashboardPage.languages.translatedOf', { translated: language.translatedCount, total: language.keyCount })}
						</span>
					</div>
				</div>
				<div className={classes.progress}>
					<Progress
						aria-hidden
						value={language.keyCount === 0 ? 0 : (language.translatedCount / language.keyCount) * 100}
						size={6}
						radius='xl'
						classNames={{ root: classes.track, section: classes.fill }}
					/>
				</div>
			</>
		)
		return (
			<li key={language.id}>
				{language.isBase ? (
					<div className={classes.row}>{content}</div>
				) : (
					<Link
						to='/projects/$projectSlug/translations'
						params={{ projectSlug }}
						search={{ target: language.tag, languages: [language.tag], status: 'UNTRANSLATED' }}
						aria-label={`${t('dashboardPage.languages.openLabel', { name })}, ${percent}`}
						className={classes.row}
					>
						{content}
					</Link>
				)}
			</li>
		)
	}

	const renderBody = (): ReactNode => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<div key={index} className='flex items-center gap-3 py-2'>
					<Skeleton circle height={32} />
					<Skeleton height={12} width='40%' radius='sm' />
				</div>
			))
		}
		if (isError) {
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('dashboardPage.languages.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('dashboardPage.languages.retry')}
					</Button>
				</div>
			)
		}
		if (data.length === 0) {
			return (
				<Text size='sm' className={classes.state}>
					{t('dashboardPage.languages.empty')}
				</Text>
			)
		}
		return (
			<ul aria-label={t('dashboardPage.languages.label')} className={classes.list}>
				{data.map(renderRow)}
			</ul>
		)
	}

	return (
		<SectionCard
			title={t('dashboardPage.languages.title')}
			description={t('dashboardPage.languages.description')}
			action={
				manageable && (
					<Link to='/projects/$projectSlug/languages' params={{ projectSlug }} className={classes.link}>
						{t('dashboardPage.languages.manage')}
					</Link>
				)
			}
		>
			<div aria-busy={isPending}>{renderBody()}</div>
		</SectionCard>
	)
}

export default LanguageStatus
