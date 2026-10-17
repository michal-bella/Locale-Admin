import { Text, Title } from '@mantine/core'

import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import classes from './PageIntro.module.css'
import { type PageIntroProps } from './types'

/** Eyebrow, heading and description at the top of a page. The heading is also the page's `document.title`. */
const PageIntro = ({ eyebrow, title, description, titleSize }: PageIntroProps) => {
	useDocumentTitle(title)

	return (
		<div className='flex flex-col gap-2'>
			<Text fz='3xs' fw={700} c='var(--app-color-eyebrow)' lh={1.5} tt='uppercase' className={classes.eyebrow}>
				{eyebrow}
			</Text>
			<Title order={1} size={titleSize} c='var(--app-color-heading)' className={classes.title}>
				{title}
			</Title>
			<Text size='sm'>{description}</Text>
		</div>
	)
}

export default PageIntro
