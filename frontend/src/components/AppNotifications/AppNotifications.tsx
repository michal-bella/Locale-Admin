import { MantineThemeProvider, Notification } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Mantine `Notifications` whose close buttons have a translated accessible name (Mantine renders them without one). */
const AppNotifications = () => {
	const { t } = useTranslation()
	const closeLabel = t('notification.close')
	const theme = useMemo(
		() => ({ components: { Notification: Notification.extend({ defaultProps: { closeButtonProps: { 'aria-label': closeLabel } } }) } }),
		[closeLabel],
	)

	return (
		<MantineThemeProvider theme={theme}>
			<Notifications />
		</MantineThemeProvider>
	)
}

export default AppNotifications
