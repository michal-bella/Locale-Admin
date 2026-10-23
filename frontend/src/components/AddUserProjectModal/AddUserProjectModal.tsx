import { Button, Select, Skeleton, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { type SubmitEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import { useAdminProjectsQuery } from '@/api/adminProjects/adminProjectsQuery'
import { useAddUserProjectMutation } from '@/api/adminUsers/useAddUserProjectMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import AppModal from '@/components/AppModal/AppModal'
import { ChevronDown } from '@/components/Icons'

import { type AddUserProjectModalProps } from './types'

/** "Pridať do projektu" on the user detail: a searchable select over the projects the user is not a member of yet. */
const AddUserProjectModal = ({ user, opened, onClose }: AddUserProjectModalProps) => {
	const { t } = useTranslation()
	const projects = useAdminProjectsQuery(opened)
	const addProject = useAddUserProjectMutation(user.id)
	const { isPending } = addProject
	const [projectId, setProjectId] = useState<string | null>(null)
	const [fieldError, setFieldError] = useState<string>()
	const inputRef = useRef<HTMLInputElement>(null)

	const memberOf = new Set(user.projects.map((project) => project.id))
	const options = (projects.data?.projects ?? [])
		.filter((project) => !memberOf.has(project.id))
		.map((project) => ({ value: project.id, label: project.name }))

	const resetAndClose = () => {
		setProjectId(null)
		setFieldError(undefined)
		addProject.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault()
		const picked = options.find((option) => option.value === projectId)
		if (!picked || isPending) {
			return
		}
		addProject.mutate(picked.value, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('userPage.addModal.success', { email: user.email, name: picked.label }) })
				resetAndClose()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				if (code === ERROR_CODE.ALREADY_MEMBER || code === ERROR_CODE.NOT_FOUND) {
					setProjectId(null)
					setFieldError(t(`errors.${code}`))
					// Deferred so the error is in the DOM (aria-describedby) when the input gets focus and is announced.
					setTimeout(() => inputRef.current?.focus())
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	}

	const renderField = () => {
		if (projects.isPending) {
			return (
				<div className='flex flex-col gap-2' aria-busy>
					<Skeleton height={14} width='30%' radius='sm' />
					<Skeleton height={36} radius='md' />
				</div>
			)
		}
		if (projects.isError) {
			return (
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('userPage.addModal.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(projects.error)}`)}</Text>
					<Button variant='default' mt='md' loading={projects.isRefetching} onClick={() => void projects.refetch()}>
						{t('userPage.addModal.retry')}
					</Button>
				</div>
			)
		}
		return (
			<Select
				ref={inputRef}
				data-autofocus
				searchable
				label={t('userPage.addModal.project.label')}
				placeholder={t('userPage.addModal.project.placeholder')}
				nothingFoundMessage={t('userPage.addModal.nothingFound')}
				value={projectId}
				onChange={(value) => {
					setProjectId(value)
					setFieldError(undefined)
				}}
				error={fieldError}
				data={options}
				rightSection={<ChevronDown aria-hidden />}
				rightSectionPointerEvents='none'
			/>
		)
	}

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('userPage.addModal.title')}
			description={t('userPage.addModal.description', { email: user.email })}
			closeLabel={t('userPage.addModal.close')}
			isPending={isPending}
			onSubmit={handleSubmit}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('userPage.addModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending} disabled={!projectId}>
						{t('userPage.addModal.submit')}
					</Button>
				</>
			}
		>
			{renderField()}
		</AppModal>
	)
}

export default AddUserProjectModal
