import { Button, createTheme, type CSSVariablesResolver, type MantineColorsTuple, rem } from '@mantine/core'

import buttonClasses from '@/styles/components/Button.module.css'

const FONT_FAMILY = "'DM Sans Variable', ui-sans-serif, system-ui, sans-serif"

/** Primary pink from Figma: shade 6 = #E83E8C (buttons, logo), shade 7 = #D72F7C (eyebrow text). */
const brand: MantineColorsTuple = ['#fdeef5', '#fbd9e8', '#f6b0d0', '#f184b6', '#ed5f9f', '#ea4b93', '#e83e8c', '#d72f7c', '#b9246a', '#961a55']

/** Tailwind v4 slate 50–900 (index 0 = slate-50, index 9 = slate-900). slate-950 is `theme.black`. */
const slate: MantineColorsTuple = ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cad5e2', '#90a1b9', '#62748e', '#45556c', '#314158', '#1d293d', '#0f172b']

export const mantineTheme = createTheme({
	primaryColor: 'brand',
	primaryShade: 6,
	colors: { brand, slate },
	black: '#020618',
	white: '#ffffff',
	fontFamily: FONT_FAMILY,
	fontSizes: { '3xs': rem(10), '2xs': rem(11), xs: rem(12), sm: rem(14), md: rem(16), lg: rem(18), xl: rem(20) },
	lineHeights: { xs: '1.3333', sm: '1.4286', md: '1.5' },
	headings: {
		fontFamily: FONT_FAMILY,
		fontWeight: '700',
		sizes: { h1: { fontSize: rem(32), lineHeight: '1.5' } },
	},
	radius: { xs: rem(4), sm: rem(8), md: rem(10), lg: rem(12), xl: rem(16) },
	defaultRadius: 'md',
	shadows: {
		primary: '0 4px 11px rgba(232, 62, 140, 0.2)',
		'primary-lg': '0 5px 14px rgba(232, 62, 140, 0.3)',
	},
	components: {
		Button: Button.extend({
			defaultProps: { size: 'md', variant: 'filled' },
			classNames: { root: buttonClasses.root },
			vars: (_theme, props) => ({
				root: props.size === 'md' ? { '--button-height': rem(40), '--button-padding-x': rem(15), '--button-fz': 'var(--mantine-font-size-xs)' } : {},
			}),
		}),
	},
})

export const cssVariablesResolver: CSSVariablesResolver = () => ({
	variables: {},
	light: {
		'--mantine-color-body': '#f7f8fb',
		'--mantine-color-text': 'var(--mantine-color-slate-5)',
	},
	dark: {},
})
