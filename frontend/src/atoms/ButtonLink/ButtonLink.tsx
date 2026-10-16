import { Button } from '@mantine/core'
import { createLink } from '@tanstack/react-router'

import { type ButtonLinkBaseProps } from './types'

const ButtonLinkBase = (props: ButtonLinkBaseProps) => <Button component='a' {...props} />

/** Mantine Button rendered as a type-safe TanStack Router link (`to`, `params`, `search`). */
const ButtonLink = createLink(ButtonLinkBase)

export default ButtonLink
