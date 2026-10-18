import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { type CreateProjectRequest, createProjectRequestSchema, ERROR_CODE, toValidationCode } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useCreateProjectMutation } from '@/api/projects/useCreateProjectMutation'
import AppModal from '@/components/AppModal/AppModal'
import { toSlug } from '@/lib/utils'

import { type CreateProjectModalProps } from './types'

/** "Nový projekt": name and slug. The slug follows the name until the user edits it. On success opens the new project. */
const CreateProjectModal = ({ opened, onClose }: CreateProjectModalProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const createProject = useCreateProjectMutation()
	const { isPending } = createProject
	const [slugEdited, setSlugEdited] = useState(false)
	const {
		register,
		handleSubmit,
		setError,
		setValue,
		reset,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(createProjectRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: { name: '', slug: '' },
	})

	const resetAndClose = () => {
		reset()
		setSlugEdited(false)
		createProject.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((values) => {
		if (isPending) {
			return
		}
		createProject.mutate(values, {
			onSuccess: (project) => {
				notifications.show({ color: 'green', message: t('projectsPage.createModal.success', { name: project.name }) })
				resetAndClose()
				void navigate({ to: '/projects/$projectId/settings', params: { projectId: project.id } })
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }, index) =>
						setError(path as keyof CreateProjectRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
					)
					return
				}
				if (code === ERROR_CODE.SLUG_TAKEN) {
					setError('slug', { message: t('errors.SLUG_TAKEN') }, { shouldFocus: true })
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	})

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('projectsPage.createModal.title')}
			description={t('projectsPage.createModal.description')}
			closeLabel={t('projectsPage.createModal.close')}
			isPending={isPending}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('projectsPage.createModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('projectsPage.createModal.submit')}
					</Button>
				</>
			}
		>
			<TextInput
				data-autofocus
				autoComplete='off'
				label={t('projectsPage.createModal.name.label')}
				placeholder={t('projectsPage.createModal.name.placeholder')}
				error={errors.name?.message}
				{...register('name', {
					onChange: (event: { target: { value: string } }) => {
						if (!slugEdited) {
							setValue('slug', toSlug(event.target.value))
						}
					},
				})}
			/>
			<TextInput
				autoComplete='off'
				label={t('projectsPage.createModal.slug.label')}
				description={t('projectsPage.createModal.slug.hint')}
				placeholder={t('projectsPage.createModal.slug.placeholder')}
				inputWrapperOrder={['label', 'input', 'description', 'error']}
				error={errors.slug?.message}
				{...register('slug', { onChange: () => setSlugEdited(true) })}
			/>
		</AppModal>
	)
}

export default CreateProjectModal
