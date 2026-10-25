import { Button, Select, Skeleton, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { type SubmitEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, PROJECT_ROLE, ROLE } from '@locale/shared'

import { useAdminUsersQuery } from '@/api/adminUsers/adminUsersQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectMembersQuery } from '@/api/projectMembers/projectMembersQuery'
import { useAddProjectMemberMutation } from '@/api/projectMembers/useAddProjectMemberMutation'
import AppModal from '@/components/AppModal/AppModal'
import CreateUserModal from '@/components/CreateUserModal/CreateUserModal'
import { ChevronDown, Plus } from '@/components/Icons'

import { type AddMemberModalProps } from './types'

/**
 * "Pridať člena" (ADMIN only): a searchable select over the users who are neither members yet nor admins. "Vytvoriť nového používateľa"
 * opens `CreateUserModal` on top and preselects the created user unless it is an admin; the admin still confirms with Pridať.
 */
const AddMemberModal = ({ projectId, opened, onClose }: AddMemberModalProps) => {
	const { t } = useTranslation()
	const users = useAdminUsersQuery(opened)
	const { data: membersData } = useProjectMembersQuery(projectId)
	const addMember = useAddProjectMemberMutation(projectId)
	const { isPending } = addMember
	const [userId, setUserId] = useState<string | null>(null)
	const [fieldError, setFieldError] = useState<string>()
	const [createOpened, createModal] = useDisclosure(false)
	const inputRef = useRef<HTMLInputElement>(null)

	const memberIds = new Set(membersData?.members.map((member) => member.id))
	// An ADMIN works in every project without a membership (409 MEMBER_IS_ADMIN), so admins are not offered.
	const options = (users.data?.users ?? [])
		.filter((user) => user.role !== ROLE.ADMIN && !memberIds.has(user.id))
		.map((user) => ({ value: user.id, label: user.email }))

	const resetAndClose = () => {
		setUserId(null)
		setFieldError(undefined)
		addMember.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!userId || isPending) {
			return
		}
		addMember.mutate(
			{ userId, role: PROJECT_ROLE.EDITOR },
			{
				onSuccess: (member) => {
					notifications.show({ color: 'green', message: t('membersPage.addModal.success', { email: member.email }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					if (code === ERROR_CODE.ALREADY_MEMBER || code === ERROR_CODE.MEMBER_IS_ADMIN || code === ERROR_CODE.NOT_FOUND) {
						setUserId(null)
						setFieldError(t(`errors.${code}`))
						// Deferred so the error is in the DOM (aria-describedby) when the input gets focus and is announced.
						setTimeout(() => inputRef.current?.focus())
						return
					}
					notifications.show({ color: 'red', message: t(`errors.${code}`) })
				},
			},
		)
	}

	const renderField = () => {
		if (users.isPending) {
			return (
				<div className='flex flex-col gap-2' aria-busy>
					<Skeleton height={14} width='30%' radius='sm' />
					<Skeleton height={36} radius='md' />
				</div>
			)
		}
		if (users.isError) {
			return (
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('membersPage.addModal.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(users.error)}`)}</Text>
					<Button variant='default' mt='md' loading={users.isRefetching} onClick={() => void users.refetch()}>
						{t('membersPage.addModal.retry')}
					</Button>
				</div>
			)
		}
		return (
			<Select
				ref={inputRef}
				data-autofocus
				searchable
				// Focus comes back here after the nested CreateUserModal closes; the list must not open over the submit button.
				openOnFocus={false}
				label={t('membersPage.addModal.user.label')}
				placeholder={t('membersPage.addModal.user.placeholder')}
				nothingFoundMessage={t('membersPage.addModal.nothingFound')}
				value={userId}
				onChange={(value) => {
					setUserId(value)
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
		<>
			<AppModal
				opened={opened}
				onClose={handleClose}
				title={t('membersPage.addModal.title')}
				description={t('membersPage.addModal.description')}
				closeLabel={t('membersPage.addModal.close')}
				isPending={isPending}
				inBackground={createOpened}
				onSubmit={handleSubmit}
				footer={
					<>
						<Button variant='default' onClick={handleClose} disabled={isPending}>
							{t('membersPage.addModal.cancel')}
						</Button>
						<Button type='submit' loading={isPending} disabled={!userId}>
							{t('membersPage.addModal.submit')}
						</Button>
					</>
				}
			>
				{renderField()}
				<div>
					<Button variant='default' leftSection={<Plus aria-hidden />} onClick={createModal.open} disabled={isPending}>
						{t('membersPage.addModal.createUser')}
					</Button>
				</div>
			</AppModal>
			<CreateUserModal
				opened={createOpened}
				onClose={createModal.close}
				defaultRole={ROLE.USER}
				onCreated={(user) => {
					if (user.role !== ROLE.ADMIN) {
						setUserId(user.id)
						setFieldError(undefined)
					}
				}}
			/>
		</>
	)
}

export default AddMemberModal
