import { Text, Title } from '@mantine/core'

import classes from './PageIntro.module.css'
import { type PageIntroProps } from './types'

/** Eyebrow, heading and description at the top of a page. */
const PageIntro = ({ eyebrow, title, description, titleSize }: PageIntroProps) => (
	<div className='flex flex-col gap-2'>
		<Text fz='3xs' fw={700} c='brand.7' lh={1.5} tt='uppercase' className={classes.eyebrow}>
			{eyebrow}
		</Text>
		<Title order={1} size={titleSize} c='black' className={classes.title}>
			{title}
		</Title>
		<Text size='sm'>{description}</Text>
	</div>
)

export default PageIntro
