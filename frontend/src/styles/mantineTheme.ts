import {
	Button,
	createTheme,
	type CSSVariablesResolver,
	Input,
	InputWrapper,
	localStorageColorSchemeManager,
	type MantineColorsTuple,
	Modal,
	rem,
} from '@mantine/core'

import { COLOR_SCHEME_STORAGE_KEY } from '@/lib/constants'
import buttonClasses from '@/styles/components/Button.module.css'
import inputClasses from '@/styles/components/Input.module.css'
import inputWrapperClasses from '@/styles/components/InputWrapper.module.css'
import modalClasses from '@/styles/components/Modal.module.css'

const FONT_FAMILY = "'DM Sans Variable', ui-sans-serif, system-ui, sans-serif"

/** Primary pink from Figma: shade 6 = #E83E8C (buttons, logo), shade 7 = #D72F7C (eyebrow text). */
const brand: MantineColorsTuple = ['#fdeef5', '#fbd9e8', '#f6b0d0', '#f184b6', '#ed5f9f', '#ea4b93', '#e83e8c', '#d72f7c', '#b9246a', '#961a55']

/** Tailwind v4 slate 50–900 (index 0 = slate-50, index 9 = slate-900). slate-950 is `theme.black`. */
const slate: MantineColorsTuple = ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cad5e2', '#90a1b9', '#62748e', '#45556c', '#314158', '#1d293d', '#0f172b']

/**
 * Replaces Mantine's neutral gray `dark` palette, which Mantine's own components use only in the dark scheme, with slate:
 * 0 slate-200 (text), 2 slate-400 (dimmed), 4 slate-700 (borders), 5 slate-800 (hover), 6 slate-900 (inputs, dropdowns), 7–8 between slate-900 and slate-950, 9 slate-950.
 */
const dark: MantineColorsTuple = ['#e2e8f0', '#cad5e2', '#90a1b9', '#62748e', '#314158', '#1d293d', '#0f172b', '#0b1222', '#070e1d', '#020618']

export const mantineTheme = createTheme({
	primaryColor: 'brand',
	primaryShade: 6,
	colors: { brand, slate, dark },
	black: '#020618',
	white: '#ffffff',
	fontFamily: FONT_FAMILY,
	respectReducedMotion: true,
	fontSizes: { '4xs': rem(9), '3xs': rem(10), '2xs': rem(11), xs: rem(12), sm: rem(14), md: rem(16), lg: rem(18), xl: rem(20) },
	lineHeights: { xs: '1.3333', sm: '1.4286', md: '1.5' },
	headings: {
		fontFamily: FONT_FAMILY,
		fontWeight: '700',
		sizes: { h1: { fontSize: rem(32), lineHeight: '1.5' }, h2: { fontSize: rem(28), lineHeight: '1.5' } },
	},
	radius: { xs: rem(4), sm: rem(8), md: rem(10), lg: rem(12), xl: rem(16) },
	defaultRadius: 'md',
	shadows: {
		primary: '0 4px 11px rgba(232, 62, 140, 0.2)',
		'primary-lg': '0 5px 14px rgba(232, 62, 140, 0.3)',
		modal: '0 24px 80px rgba(15, 23, 42, 0.18)',
	},
	components: {
		Button: Button.extend({
			defaultProps: { size: 'md', variant: 'filled' },
			classNames: { root: buttonClasses.root },
			vars: (_theme, props) => ({
				root: {
					...(props.size === 'md' ? { '--button-height': rem(40), '--button-padding-x': rem(15), '--button-fz': 'var(--mantine-font-size-xs)' } : {}),
					...(props.variant === 'default'
						? { '--button-bd': `${rem(1)} solid var(--app-color-border)`, '--button-color': 'var(--app-color-text-secondary)' }
						: {}),
				},
			}),
		}),
		Input: Input.extend({
			classNames: { wrapper: inputClasses.wrapper, input: inputClasses.input },
			vars: () => ({
				wrapper: { '--input-height': rem(44), '--input-radius': 'var(--mantine-radius-lg)', '--input-fz': 'var(--mantine-font-size-xs)' },
			}),
		}),
		InputWrapper: InputWrapper.extend({
			classNames: { label: inputWrapperClasses.label, error: inputWrapperClasses.error },
		}),
		// Mantine paints modal content and header with --mantine-color-body, which is the page tint here.
		Modal: Modal.extend({
			classNames: { content: modalClasses.content, header: modalClasses.header },
		}),
	},
})

export const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY })

/** Scheme-aware `--app-color-*` tokens for components and CSS modules. Light values are the Figma colors, dark values are derived from slate. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {},
	light: {
		'--mantine-color-body': '#f7f8fb',
		'--mantine-color-text': 'var(--mantine-color-slate-5)',
		'--app-color-surface': 'var(--mantine-color-white)',
		'--app-color-surface-muted': 'var(--mantine-color-slate-0)',
		'--app-color-border': 'var(--mantine-color-slate-2)',
		'--app-color-border-subtle': 'var(--mantine-color-slate-1)',
		'--app-color-heading': 'var(--mantine-color-black)',
		'--app-color-title': 'var(--mantine-color-slate-9)',
		'--app-color-text-strong': 'var(--mantine-color-slate-8)',
		'--app-color-label': 'var(--mantine-color-slate-7)',
		'--app-color-text-secondary': 'var(--mantine-color-slate-6)',
		'--app-color-muted': 'var(--mantine-color-slate-4)',
		'--app-color-eyebrow': 'var(--mantine-color-brand-7)',
		'--app-color-avatar': 'var(--mantine-color-slate-9)',
		'--app-color-avatar-muted': 'var(--mantine-color-slate-1)',
		'--app-color-brand-tint': 'var(--mantine-color-brand-0)',
	},
	dark: {
		'--mantine-color-body': 'var(--mantine-color-black)',
		'--mantine-color-text': 'var(--mantine-color-slate-4)',
		// Mantine's dark default (red-8) is below 4.5:1 on slate-900 surfaces.
		'--mantine-color-error': 'var(--mantine-color-red-6)',
		// Mantine's dark default (dark-6) equals slate-900 here, so disabled buttons and switch tracks would vanish on cards.
		'--mantine-color-disabled': 'var(--mantine-color-dark-5)',
		'--mantine-color-disabled-color': 'var(--mantine-color-dark-2)',
		'--app-color-surface': 'var(--mantine-color-slate-9)',
		'--app-color-surface-muted': 'var(--mantine-color-dark-7)',
		'--app-color-border': 'var(--mantine-color-slate-7)',
		'--app-color-border-subtle': 'var(--mantine-color-slate-8)',
		'--app-color-heading': 'var(--mantine-color-slate-0)',
		'--app-color-title': 'var(--mantine-color-slate-1)',
		'--app-color-text-strong': 'var(--mantine-color-slate-2)',
		'--app-color-label': 'var(--mantine-color-slate-3)',
		'--app-color-text-secondary': 'var(--mantine-color-slate-3)',
		'--app-color-muted': 'var(--mantine-color-slate-5)',
		// brand-7 is about 4.4:1 on slate-950, brand-4 about 6.5:1.
		'--app-color-eyebrow': 'var(--mantine-color-brand-4)',
		'--app-color-avatar': 'var(--mantine-color-slate-7)',
		'--app-color-avatar-muted': 'var(--mantine-color-slate-8)',
		'--app-color-brand-tint': 'color-mix(in srgb, var(--mantine-color-brand-9) 30%, var(--mantine-color-slate-9))',
	},
})
