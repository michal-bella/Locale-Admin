import { type FormEventHandler, type ReactNode } from 'react'

export type AppModalProps = {
	opened: boolean
	onClose: () => void
	title: string
	description?: ReactNode
	closeLabel: string
	children: ReactNode
	/** Without it the body has no footer bar, e.g. when the content is a form with its own buttons. */
	footer?: ReactNode
	/** Wraps body and footer in a `<form noValidate>`, so a submit button in the footer submits it. */
	onSubmit?: FormEventHandler<HTMLFormElement>
	/** While a request runs the modal cannot be closed (X disabled, no Esc, no outside click). */
	isPending?: boolean
	/** Another modal is open on top: Mantine listens for Esc on window, so this one must ignore it and release the focus trap. */
	inBackground?: boolean
	size?: number
	zIndex?: number
}
