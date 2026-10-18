import { Button, Skeleton, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { projectLanguagesQueryOptions } from '@/api/projectLanguages/projectLanguagesQuery'
import { projectSettingsQueryOptions } from '@/api/projectSettings/projectSettingsQuery'
import { retryUnlessNotFound } from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import AppModal from '@/components/AppModal/AppModal'
import ProjectSettingsForm from '@/components/ProjectSettingsForm/ProjectSettingsForm'

import classes from './EditProjectModal.module.css'
import { type EditProjectModalProps } from './types'

/** Heights of the two cards of the settings form, used for the loading skeletons. */
const SKELETON_HEIGHTS = [330, 152]

type ContentProps = {
	projectId: string
	onClose: () => void
	onNotFound: () => void
}

const EditProjectContent = ({ projectId, onClose, onNotFound }: ContentProps) => {
	const { t } = useTranslation()
	const settingsQuery = useQuery({ ...projectSettingsQueryOptions(projectId), retry: retryUnlessNotFound })
	const languagesQuery = useQuery({ ...projectLanguagesQueryOptions(projectId), retry: retryUnlessNotFound })
	const failedQueries = [settingsQuery, languagesQuery].filter((query) => query.isError && query.data === undefined)
	const notFound = [settingsQuery, languagesQuery].some((query) => query.isError && getApiErrorCode(query.error) === ERROR_CODE.NOT_FOUND)
	const handleNotFound = useEffectEvent(onNotFound)

	useEffect(() => {
		if (notFound) {
			handleNotFound()
		}
	}, [notFound])

	if (failedQueries.length > 0 && !notFound) {
		return (
			<div className={`${classes.state} flex flex-col items-center gap-1`}>
				<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
					{t('adminProjectsPage.editModal.loadError')}
				</Text>
				<Text size='xs'>{t(`errors.${getApiErrorCode(failedQueries[0]?.error)}`)}</Text>
				<Button
					variant='default'
					mt='md'
					loading={failedQueries.some((query) => query.isRefetching)}
					onClick={() => void Promise.all(failedQueries.map((query) => query.refetch()))}
				>
					{t('adminProjectsPage.editModal.retry')}
				</Button>
			</div>
		)
	}
	if (notFound || !settingsQuery.data || !languagesQuery.data) {
		return (
			<div aria-busy='true' className='flex flex-col gap-5'>
				{SKELETON_HEIGHTS.map((height) => (
					<Skeleton key={height} height={height} radius='xl' />
				))}
			</div>
		)
	}
	return (
		<ProjectSettingsForm
			settings={settingsQuery.data}
			languages={languagesQuery.data}
			isMember={false}
			onLeft={onClose}
			// Only closes: the URL replace after a slug change belongs to the settings page, the admin list is refetched by the mutation.
			onSaved={onClose}
			onCancel={onClose}
			onNotFound={onNotFound}
			// The focus trap already ran on the skeleton or the retry button, which are gone now.
			focusFirstField
		/>
	)
}

/** "Upraviť projekt" on Projekty: the project settings form in a modal. Closing drops unsaved changes without asking. */
const EditProjectModal = ({ opened, project, onClose }: EditProjectModalProps) => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const isSaving = useIsMutating({ mutationKey: QUERY_KEYS.PROJECTS.SETTINGS(project?.id ?? '') }) > 0

	const handleClose = () => {
		if (!isSaving) {
			onClose()
		}
	}

	// Deleted by another admin meanwhile: a retry cannot succeed, so the modal closes and the list drops the row.
	const handleNotFound = () => {
		notifications.show({ color: 'red', message: t('errors.NOT_FOUND') })
		void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() })
		onClose()
	}

	return (
		<AppModal
			opened={opened && project !== null}
			onClose={handleClose}
			title={t('adminProjectsPage.editModal.title')}
			description={project?.name}
			closeLabel={t('adminProjectsPage.editModal.close')}
			isPending={isSaving}
			size={720}
		>
			{/* Not handleClose: onSaved runs with the isSaving of a render from while the save was pending. Zrušiť is disabled meanwhile. */}
			{project && <EditProjectContent key={project.id} projectId={project.id} onClose={onClose} onNotFound={handleNotFound} />}
		</AppModal>
	)
}

export default EditProjectModal
