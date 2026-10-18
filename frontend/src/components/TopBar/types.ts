import { type ReactNode, type Ref } from 'react'

export type TopBarProps = {
	/** Id of the sidebar the burger controls below `md`. Without a sidebar (project list) there is no burger. */
	navbarId?: string
	navOpened?: boolean
	onToggleNav?: () => void
	/** Gets focus back when the sidebar closes below `md`. */
	burgerRef?: Ref<HTMLButtonElement>
	/** Left side, e.g. the brand when there is no sidebar. */
	start?: ReactNode
	/** Right side after the bell, e.g. the user menu when there is no sidebar. */
	end?: ReactNode
}
