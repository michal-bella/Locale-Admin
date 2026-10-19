import { Modal, Text } from '@mantine/core'

import { Close } from '@/components/Icons'

import classes from './AppModal.module.css'
import { type AppModalProps } from './types'

/** Modal chrome of `CreateUserModal` (Figma 28:191): title with description, close icon, body and a footer with actions. */
const AppModal = ({
	opened,
	onClose,
	title,
	description,
	closeLabel,
	children,
	footer,
	onSubmit,
	isPending = false,
	inBackground = false,
	size = 560,
	fullScreen = false,
	zIndex,
}: AppModalProps) => {
	const closable = !isPending && !inBackground
	const content = (
		<>
			<div className={`${classes.fields} flex flex-col gap-4`}>{children}</div>
			<div className={`${classes.footer} flex items-center justify-end gap-2`}>{footer}</div>
		</>
	)

	return (
		<Modal.Root
			opened={opened}
			onClose={onClose}
			closeOnEscape={closable}
			closeOnClickOutside={closable}
			trapFocus={!inBackground}
			centered
			size={size}
			fullScreen={fullScreen}
			radius='xl'
			shadow='modal'
			zIndex={zIndex}
		>
			<Modal.Overlay color='var(--mantine-color-black)' backgroundOpacity={0.25} blur={2} />
			<Modal.Content className={classes.content}>
				<Modal.Header className={classes.header}>
					<div className='flex flex-col gap-1'>
						<Modal.Title className={classes.title}>{title}</Modal.Title>
						{description && <Text size='sm'>{description}</Text>}
					</div>
					<Modal.CloseButton aria-label={closeLabel} icon={<Close aria-hidden />} disabled={isPending} className={classes.close} />
				</Modal.Header>
				<Modal.Body className={classes.body}>
					{onSubmit ? (
						<form onSubmit={onSubmit} noValidate>
							{content}
						</form>
					) : (
						content
					)}
				</Modal.Body>
			</Modal.Content>
		</Modal.Root>
	)
}

export default AppModal
