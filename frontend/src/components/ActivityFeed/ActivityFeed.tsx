import { Avatar, Button, Skeleton, Text } from '@mantine/core'
import { type ComponentType, type CSSProperties, type ReactNode, type SVGProps } from 'react'
import { useTranslation } from 'react-i18next'

import {
	ACTIVITY_TYPE,
	type ActivityEvent,
	type ActivityMember,
	LANGUAGE_TAGS,
	type LanguageTag,
	TRANSLATIONS_SEARCH_MAX_LENGTH,
	type TranslationsUpdatedWithin,
} from '@locale/shared'

import { useActivityInfiniteQuery } from '@/api/activity/activityQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { ArrowRight, Edit, Globe, Key, Settings, Tag, Upload, Users } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import SectionCard from '@/components/SectionCard/SectionCard'
import { formatDate, formatDateTime, toIntlLocale } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { getNameInitials } from '@/lib/utils'

import classes from './ActivityFeed.module.css'
import { type ActivityFeedProps } from './types'

const SKELETON_ROWS = 4

const DAY_MS = 24 * 60 * 60 * 1000

type Category = { icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }

const CATEGORY = {
	translation: { icon: Edit, color: 'brand' },
	import: { icon: Upload, color: 'blue' },
	key: { icon: Key, color: 'violet' },
	version: { icon: Tag, color: 'teal' },
	language: { icon: Globe, color: 'orange' },
	member: { icon: Users, color: 'gray' },
	project: { icon: Settings, color: 'gray' },
} satisfies Record<string, Category>

/** What the event changed, shown as a colored icon on the avatar; the sentence says the same in words. */
const CATEGORY_OF: Record<ACTIVITY_TYPE, Category> = {
	[ACTIVITY_TYPE.TRANSLATION_UPDATED]: CATEGORY.translation,
	[ACTIVITY_TYPE.KEYS_IMPORTED]: CATEGORY.import,
	[ACTIVITY_TYPE.KEY_CREATED]: CATEGORY.key,
	[ACTIVITY_TYPE.KEY_UPDATED]: CATEGORY.key,
	[ACTIVITY_TYPE.VERSION_CREATED]: CATEGORY.version,
	[ACTIVITY_TYPE.VERSION_UPDATED]: CATEGORY.version,
	[ACTIVITY_TYPE.VERSION_DELETED]: CATEGORY.version,
	[ACTIVITY_TYPE.LANGUAGE_ADDED]: CATEGORY.language,
	[ACTIVITY_TYPE.LANGUAGE_REMOVED]: CATEGORY.language,
	[ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED]: CATEGORY.language,
	[ACTIVITY_TYPE.MEMBER_ADDED]: CATEGORY.member,
	[ACTIVITY_TYPE.MEMBER_REMOVED]: CATEGORY.member,
	[ACTIVITY_TYPE.PROJECT_CREATED]: CATEGORY.project,
	[ACTIVITY_TYPE.PROJECT_UPDATED]: CATEGORY.project,
}

const isLanguageTag = (tag: string): tag is LanguageTag => (LANGUAGE_TAGS as readonly string[]).includes(tag)

const localDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/** The shortest `updatedWithin` of Preklady that still reaches back to the event; older events filter by the user only. */
const updatedWithinFor = (createdAt: string, now: Date): TranslationsUpdatedWithin | undefined => {
	const age = now.getTime() - new Date(createdAt).getTime()
	return age < DAY_MS ? 'DAY' : age < 7 * DAY_MS ? 'WEEK' : age < 30 * DAY_MS ? 'MONTH' : undefined
}

const memberName = ({ firstName, lastName, email }: ActivityMember) => [firstName, lastName].filter(Boolean).join(' ') || email

/**
 * Posledná aktivita of Figma 3:660: the project's events grouped by day, newest first, with Načítať ďalšie. The text of an event is built
 * from its type and payload snapshot, never from the API. Edits and imports link to Preklady filtered to that user's recent changes.
 */
const ActivityFeed = ({ projectId, projectSlug }: ActivityFeedProps) => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useActivityInfiniteQuery(projectId)
	const now = new Date()

	const languageName = (tag: string) => (isLanguageTag(tag) ? t(`languageNames.${tag}`) : tag)
	const list = (items: string[]) => new Intl.ListFormat(toIntlLocale(i18n.language), { type: 'conjunction' }).format(items)

	const describe = (event: ActivityEvent): string => {
		switch (event.type) {
			case ACTIVITY_TYPE.PROJECT_CREATED:
				return t('dashboardPage.activity.events.projectCreated', { name: event.payload.name })
			case ACTIVITY_TYPE.PROJECT_UPDATED:
				return t('dashboardPage.activity.events.projectUpdated', {
					fields: list(event.payload.fields.map((field) => t(`dashboardPage.activity.projectFields.${field}`))),
				})
			case ACTIVITY_TYPE.LANGUAGE_ADDED:
				return t('dashboardPage.activity.events.languageAdded', { language: languageName(event.payload.tag) })
			case ACTIVITY_TYPE.LANGUAGE_REMOVED:
				return t('dashboardPage.activity.events.languageRemoved', { language: languageName(event.payload.tag) })
			case ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED:
				return event.payload.fromTag === null
					? t('dashboardPage.activity.events.baseLanguageSet', { to: languageName(event.payload.toTag) })
					: t('dashboardPage.activity.events.baseLanguageChanged', {
							from: languageName(event.payload.fromTag),
							to: languageName(event.payload.toTag),
						})
			case ACTIVITY_TYPE.MEMBER_ADDED:
				return t('dashboardPage.activity.events.memberAdded', { member: memberName(event.payload.member) })
			case ACTIVITY_TYPE.MEMBER_REMOVED:
				return event.payload.left
					? t('dashboardPage.activity.events.memberLeft')
					: t('dashboardPage.activity.events.memberRemoved', { member: memberName(event.payload.member) })
			case ACTIVITY_TYPE.KEYS_IMPORTED: {
				const { keysCreated, keysCopied = 0, keysRemoved = 0, translationsCreated, translationsUpdated } = event.payload
				const translationCount = translationsCreated + translationsUpdated
				const parts = translationCount > 0 ? [t('dashboardPage.activity.events.translationCount', { count: translationCount })] : []
				if (keysCreated > 0) {
					parts.push(t('dashboardPage.activity.events.newKeyCount', { count: keysCreated }))
				}
				// An import into a new version can only copy the keys of the previous one; it still says what it did.
				if (keysCopied > 0) {
					parts.push(t('dashboardPage.activity.events.copiedKeyCount', { count: keysCopied }))
				}
				if (keysRemoved > 0) {
					parts.push(t('dashboardPage.activity.events.removedKeyCount', { count: keysRemoved }))
				}
				return t('dashboardPage.activity.events.keysImported', {
					changes: parts.length > 0 ? list(parts) : t('dashboardPage.activity.events.noChanges'),
				})
			}
			case ACTIVITY_TYPE.KEY_CREATED:
				return t('dashboardPage.activity.events.keyCreated', { key: event.payload.name })
			case ACTIVITY_TYPE.KEY_UPDATED:
				return t('dashboardPage.activity.events.keyUpdated', {
					key: event.payload.name,
					fields: list(event.payload.fields.map((field) => t(`dashboardPage.activity.keyFields.${field}`))),
				})
			case ACTIVITY_TYPE.TRANSLATION_UPDATED:
				return t('dashboardPage.activity.events.translationUpdated', { key: event.payload.name, language: languageName(event.payload.languageTag) })
			case ACTIVITY_TYPE.VERSION_CREATED:
				return t('dashboardPage.activity.events.versionCreated', { name: event.payload.name })
			case ACTIVITY_TYPE.VERSION_UPDATED:
				return t('dashboardPage.activity.events.versionUpdated', {
					name: event.payload.name,
					fields: list(event.payload.fields.map((field) => t(`dashboardPage.activity.versionFields.${field}`))),
				})
			case ACTIVITY_TYPE.VERSION_DELETED:
				return t('dashboardPage.activity.events.versionDeleted', { name: event.payload.name, count: event.payload.keyCount })
		}
	}

	const dayLabel = (createdAt: string) => {
		const key = localDayKey(new Date(createdAt))
		if (key === localDayKey(now)) {
			return t('dashboardPage.activity.today')
		}
		if (key === localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
			return t('dashboardPage.activity.yesterday')
		}
		return formatDate(createdAt, i18n.language)
	}

	const renderEvent = (event: ActivityEvent) => {
		const name = event.user?.name ?? t('dashboardPage.activity.deletedUser')
		const category = CATEGORY_OF[event.type]
		const changedBy = event.type === ACTIVITY_TYPE.TRANSLATION_UPDATED || event.type === ACTIVITY_TYPE.KEYS_IMPORTED ? event.user : null
		// The key, not the editor filter: that one matches the last editor, so a later edit by someone else would hide the row.
		const editedKey = event.type === ACTIVITY_TYPE.TRANSLATION_UPDATED && event.payload.name.length <= TRANSLATIONS_SEARCH_MAX_LENGTH ? event.payload : null
		return (
			<li key={event.id} className={classes.row}>
				<span className={classes.avatar} aria-hidden>
					<Avatar size={32} radius='xl' color='var(--app-color-avatar-muted)' variant='filled' classNames={{ placeholder: classes.initials }}>
						{event.user ? getNameInitials(event.user.name) : '?'}
					</Avatar>
					<span className={classes.category} style={{ '--category-color': `var(--mantine-color-${category.color}-filled)` } as CSSProperties}>
						<category.icon />
					</span>
				</span>
				<div className='flex min-w-0 flex-1 flex-col'>
					<span className={classes.sentence}>
						<span className={classes.name}>{name}</span> · {describe(event)}
					</span>
					<span className={classes.time}>
						<time dateTime={event.createdAt} title={formatDateTime(event.createdAt, i18n.language)}>
							{formatRelativeTime(event.createdAt, i18n.language, now, 'short')}
						</time>
						{event.version && <> · {event.version.name}</>}
					</span>
				</div>
				{editedKey ? (
					<RowAction
						icon={ArrowRight}
						tooltip={t('dashboardPage.activity.open')}
						label={t('dashboardPage.activity.openKeyLabel', { key: editedKey.name })}
						to='/projects/$projectSlug/translations'
						params={{ projectSlug }}
						search={{
							search: editedKey.name,
							namespace: editedKey.namespace,
							version: event.version?.id,
							editKey: editedKey.keyId,
							editLanguage: isLanguageTag(editedKey.languageTag) ? editedKey.languageTag : undefined,
						}}
					/>
				) : (
					changedBy && (
						<RowAction
							icon={ArrowRight}
							tooltip={t('dashboardPage.activity.open')}
							label={t('dashboardPage.activity.openLabel', { name })}
							to='/projects/$projectSlug/translations'
							params={{ projectSlug }}
							search={{ updatedBy: changedBy.id, updatedWithin: updatedWithinFor(event.createdAt, now) }}
						/>
					)
				)}
			</li>
		)
	}

	const renderBody = (): ReactNode => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<div key={index} className='flex items-center gap-3 py-2'>
					<Skeleton circle height={32} />
					<Skeleton height={12} width='60%' radius='sm' />
				</div>
			))
		}
		if (isError) {
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('dashboardPage.activity.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('dashboardPage.activity.retry')}
					</Button>
				</div>
			)
		}
		const events = data.pages.flatMap((page) => page.items)
		if (events.length === 0) {
			return (
				<Text size='sm' className={classes.state}>
					{t('dashboardPage.activity.empty')}
				</Text>
			)
		}
		const days = new Map<string, ActivityEvent[]>()
		for (const event of events) {
			const label = dayLabel(event.createdAt)
			days.set(label, [...(days.get(label) ?? []), event])
		}
		return (
			<div className='flex flex-col gap-4'>
				{[...days].map(([label, dayEvents]) => (
					<div key={label}>
						<h3 className={classes.day}>{label}</h3>
						<ul aria-label={label} className={classes.list}>
							{dayEvents.map(renderEvent)}
						</ul>
					</div>
				))}
				{hasNextPage && (
					<Button variant='default' className='self-center' loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
						{t('dashboardPage.activity.loadMore')}
					</Button>
				)}
			</div>
		)
	}

	return (
		<SectionCard title={t('dashboardPage.activity.title')} description={t('dashboardPage.activity.description')}>
			<div aria-busy={isPending}>{renderBody()}</div>
		</SectionCard>
	)
}

export default ActivityFeed
