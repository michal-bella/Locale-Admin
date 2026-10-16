import { type ButtonProps } from '@mantine/core'
import { type ComponentPropsWithRef } from 'react'

export type ButtonLinkBaseProps = Omit<ButtonProps, 'component'> & Omit<ComponentPropsWithRef<'a'>, keyof ButtonProps>
