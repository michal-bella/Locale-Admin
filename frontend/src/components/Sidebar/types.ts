export type SidebarProps = {
	id: string
	/** Below `md` the sidebar is off-canvas: `opened` shows it, `onClose` hides it (also after navigating). */
	opened: boolean
	onClose: () => void
}
