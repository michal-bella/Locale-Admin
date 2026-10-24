import { type ComponentType, type SVGProps } from 'react'

import { type ActivityCategory } from '@locale/shared'

import { Edit, Globe, Key, Settings, Tag, Upload, Users } from '@/components/Icons'

/** Icon and Mantine color of each activity category, for the avatar corner of the feed and the type badge of História. */
export const ACTIVITY_CATEGORY_STYLE: Record<ActivityCategory, { icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }> = {
	TRANSLATION: { icon: Edit, color: 'brand' },
	IMPORT: { icon: Upload, color: 'blue' },
	KEY: { icon: Key, color: 'violet' },
	VERSION: { icon: Tag, color: 'teal' },
	LANGUAGE: { icon: Globe, color: 'orange' },
	MEMBER: { icon: Users, color: 'gray' },
	PROJECT: { icon: Settings, color: 'gray' },
}
