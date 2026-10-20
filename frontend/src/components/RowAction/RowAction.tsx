import { ActionIcon, Tooltip } from '@mantine/core'
import { Link } from '@tanstack/react-router'

import classes from './RowAction.module.css'
import { type RowActionProps } from './types'

// Mantine tooltips ignore focus by default; keyboard users need the name of an icon-only button.
const TOOLTIP_EVENTS = { hover: true, focus: true, touch: false } as const

/** Explicit icon button (or link, with `to`) for one action in a table row, used instead of a `⋯` menu. */
const RowAction = ({ icon: Icon, tooltip, label, danger = false, ...action }: RowActionProps) => {
	const shared = { variant: 'transparent', size: 34, radius: 'sm', 'aria-label': label, mod: { danger }, className: classes.root } as const

	if (action.to !== undefined) {
		return (
			<Tooltip label={tooltip} events={TOOLTIP_EVENTS}>
				<ActionIcon renderRoot={(props) => <Link {...props} to={action.to} params={action.params} search={action.search} />} {...shared}>
					<Icon aria-hidden />
				</ActionIcon>
			</Tooltip>
		)
	}
	return (
		<Tooltip label={tooltip} disabled={action.disabled} events={TOOLTIP_EVENTS}>
			<ActionIcon disabled={action.disabled} onClick={action.onClick} {...shared}>
				<Icon aria-hidden />
			</ActionIcon>
		</Tooltip>
	)
}

export default RowAction
