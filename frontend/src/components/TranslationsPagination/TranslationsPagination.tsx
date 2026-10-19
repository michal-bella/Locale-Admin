import { Button, Text } from '@mantine/core'
import { usePagination } from '@mantine/hooks'
import { useTranslation } from 'react-i18next'

import classes from './TranslationsPagination.module.css'
import { type TranslationsPaginationProps } from './types'

/**
 * „Zobrazených 50 z 248 kľúčov“ with Predošlá, page numbers and Ďalšia (Figma 3:348). The buttons show only with more than one page.
 * Predošlá and Ďalšia on the first or last page look disabled (`data-disabled`) but stay focusable: reaching the last page with Ďalšia would otherwise drop the focus to the body.
 */
const TranslationsPagination = ({ page, pageSize, total, shown, onChange }: TranslationsPaginationProps) => {
	const { t } = useTranslation()
	const pages = Math.max(1, Math.ceil(total / pageSize))
	const { range } = usePagination({ total: pages, page, onChange })

	return (
		<div className='flex flex-wrap items-center justify-between gap-3 px-1'>
			<Text fz='xs' c='var(--app-color-muted)'>
				{t('translationsPage.pagination.summary', { shown, count: total })}
			</Text>
			{pages > 1 && (
				<nav aria-label={t('translationsPage.pagination.label')} className='flex items-center gap-1'>
					<Button
						variant='default'
						size='compact-sm'
						className={classes.control}
						data-disabled={page <= 1 || undefined}
						aria-disabled={page <= 1 || undefined}
						onClick={() => page > 1 && onChange(page - 1)}
					>
						{t('translationsPage.pagination.previous')}
					</Button>
					{range.map((item, index) =>
						item === 'dots' ? (
							<span key={`dots-${index}`} aria-hidden className={classes.dots}>
								…
							</span>
						) : (
							<Button
								key={item}
								variant={item === page ? 'filled' : 'default'}
								size='compact-sm'
								className={classes.control}
								aria-label={t('translationsPage.pagination.page', { page: item })}
								aria-current={item === page ? 'page' : undefined}
								onClick={() => onChange(item)}
							>
								{item}
							</Button>
						),
					)}
					<Button
						variant='default'
						size='compact-sm'
						className={classes.control}
						data-disabled={page >= pages || undefined}
						aria-disabled={page >= pages || undefined}
						onClick={() => page < pages && onChange(page + 1)}
					>
						{t('translationsPage.pagination.next')}
					</Button>
				</nav>
			)}
		</div>
	)
}

export default TranslationsPagination
