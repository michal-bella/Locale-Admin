import { Button, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import { useDeleteProjectMutation } from '@/api/adminProjects/useDeleteProjectMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import AppModal from '@/components/AppModal/AppModal'

import { type DeleteProjectModalProps } from './types'

/** Confirmation of deleting a project on Projekty: the admin retypes the slug before the delete button turns on. */
const DeleteProjectModal = ({ opened, project, onClose, onDeleted }: DeleteProjectModalProps) => {
	const { t } = useTranslation()
	const deleteProject = useDeleteProjectMutation()
	const { isPending } = deleteProject
	const [typedSlug, setTypedSlug] = useState('')
	const confirmed = project !== null && typedSlug === project.slug

	const finish = (callback: () => void) => {
		setTypedSlug('')
		deleteProject.reset()
		callback()
	}

	const handleClose = () => {
		if (!isPending) {
			finish(onClose)
		}
	}

	const handleConfirm = () => {
		if (!project || !confirmed || isPending) {
			return
		}
		deleteProject.mutate(project.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('adminProjectsPage.deleteModal.success', { name: project.name }) })
				finish(onDeleted)
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
				if (code === ERROR_CODE.NOT_FOUND) {
					finish(onDeleted)
				}
			},
		})
	}

	return (
		<AppModal
			opened={opened && project !== null}
			onClose={handleClose}
			title={t('adminProjectsPage.deleteModal.title')}
			closeLabel={t('adminProjectsPage.deleteModal.close')}
			isPending={isPending}
			size={480}
			onSubmit={(event) => {
				event.preventDefault()
				handleConfirm()
			}}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('adminProjectsPage.deleteModal.cancel')}
					</Button>
					<Button type='submit' color='red' loading={isPending} disabled={!confirmed}>
						{t('adminProjectsPage.deleteModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{project && t('adminProjectsPage.deleteModal.message', { name: project.name })}</Text>
			<TextInput
				data-autofocus
				autoComplete='off'
				spellCheck={false}
				label={project && t('adminProjectsPage.deleteModal.slug.label', { slug: project.slug })}
				value={typedSlug}
				onChange={(event) => setTypedSlug(event.currentTarget.value)}
				disabled={isPending}
			/>
		</AppModal>
	)
}

export default DeleteProjectModal
