import { ActionIcon, Tooltip } from '@mantine/core'
import { Link } from '@tanstack/react-router'

import classes from './RowAction.module.css'
import { type RowActionProps } from './types'

/** Explicit icon button (or link, with `to`) for one action in a table row, used instead of a `⋯` menu. */
const RowAction = ({ icon: Icon, tooltip, label, danger = false, ...action }: RowActionProps) => {
	const shared = { variant: 'transparent', size: 34, radius: 'sm', 'aria-label': label, mod: { danger }, className: classes.root } as const

	if (action.to !== undefined) {
		return (
			<Tooltip label={tooltip}>
				<ActionIcon renderRoot={(props) => <Link {...props} to={action.to} params={action.params} />} {...shared}>
					<Icon aria-hidden />
				</ActionIcon>
			</Tooltip>
		)
	}
	return (
		<Tooltip label={tooltip} disabled={action.disabled}>
			<ActionIcon disabled={action.disabled} onClick={action.onClick} {...shared}>
				<Icon aria-hidden />
			</ActionIcon>
		</Tooltip>
	)
}

export default RowAction
