import { ActionIcon, Tooltip } from '@mantine/core'

import classes from './RowAction.module.css'
import { type RowActionProps } from './types'

/** Explicit icon button for one action in a table row, used instead of a `⋯` menu. */
const RowAction = ({ icon: Icon, tooltip, label, danger = false, disabled = false, onClick }: RowActionProps) => (
	<Tooltip label={tooltip} disabled={disabled} events={{ hover: true, focus: true, touch: false }}>
		<ActionIcon
			variant='transparent'
			size={34}
			radius='sm'
			aria-label={label}
			disabled={disabled}
			mod={{ danger }}
			className={classes.root}
			onClick={onClick}
		>
			<Icon aria-hidden />
		</ActionIcon>
	</Tooltip>
)

export default RowAction
