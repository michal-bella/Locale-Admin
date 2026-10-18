export type UserMenuProps = {
	/** Called after a menu link is chosen (closes the mobile sidebar). */
	onNavigate?: () => void
	/** `sidebar`: block at the bottom of the sidebar, menu opens upwards. `header`: in the top bar of the project list, menu opens downwards. */
	placement?: 'sidebar' | 'header'
}
