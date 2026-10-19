import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { formatImportIssue } from '@/lib/importIssues'

import classes from './ImportIssueList.module.css'
import { type ImportIssueListProps } from './types'

/** Issues of an imported file as translated sentences with the line (and column) of the file. */
const ImportIssueList = ({ title, issues, total, tone }: ImportIssueListProps) => {
	const { t } = useTranslation()
	const more = total - issues.length

	return (
		<div className={`${classes.root} flex flex-col gap-2`} data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
			<Text size='sm' fw={600} className={classes.title}>
				{title}
			</Text>
			<ul className={`${classes.list} flex flex-col gap-1`}>
				{issues.map((issue, index) => (
					<li key={index}>{formatImportIssue(t, issue)}</li>
				))}
			</ul>
			{more > 0 && (
				<Text size='xs' className={classes.title}>
					{t('importModal.issues.more', { count: more })}
				</Text>
			)}
		</div>
	)
}

export default ImportIssueList
