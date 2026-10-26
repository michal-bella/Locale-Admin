import { Button, Skeleton, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, ROLE } from '@locale/shared'

import { useAdminUserQuery } from '@/api/adminUsers/adminUserQuery'
import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import AddUserProjectModal from '@/components/AddUserProjectModal/AddUserProjectModal'
import DeleteUserModal from '@/components/DeleteUserModal/DeleteUserModal'
import { Plus, Trash } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'
import UserCard from '@/components/UserCard/UserCard'
import UserProjectsTable from '@/components/UserProjectsTable/UserProjectsTable'

import classes from './UserPage.module.css'

/**
 * Detail of one user (ADMIN only): account card (role, email) and the projects they are a member of, with adding and removing (an admin
 * works in every project, so only a note is shown); the user can be deleted here too, except the own account. No Figma, same look as Používatelia.
 */
const UserPage = () => {
	const { t } = useTranslation()
	const { userId } = useParams({ from: '/_authenticated/_app/admin/users/$userId' })
	const { data, isPending, isError, error, refetch, isRefetching } = useAdminUserQuery(userId)
	const [modalOpened, modal] = useDisclosure(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const { data: me } = useMeQuery()
	const navigate = useNavigate()
	const [deleteOpened, deleteModal] = useDisclosure(false)

	const closeModal = () => {
		modal.close()
		triggerRef.current?.focus()
	}

	const renderContent = () => {
		if (isPending) {
			return (
				<div aria-busy='true' className='flex flex-col gap-6'>
					<Skeleton height={108} radius='xl' />
					<Skeleton height={36} width='12rem' radius='md' />
					<Skeleton height={180} radius='xl' />
				</div>
			)
		}
		if (isError) {
			const code = getApiErrorCode(error)
			if (code === ERROR_CODE.NOT_FOUND) {
				return (
					<div className={`${classes.state} flex flex-col items-center gap-1`}>
						<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
							{t('userPage.notFound.title')}
						</Text>
						<Text size='xs'>{t('userPage.notFound.description')}</Text>
						<ButtonLink to='/admin/users' search variant='default' mt='md'>
							{t('userPage.notFound.back')}
						</ButtonLink>
					</div>
				)
			}
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('userPage.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${code}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('userPage.retry')}
					</Button>
				</div>
			)
		}
		return (
			<>
				<UserCard user={data} />
				<div className='flex flex-wrap items-end justify-between gap-4'>
					<Title order={2} size='h4' c='var(--app-color-heading)'>
						{t('userPage.projects.title')}
					</Title>
					{data.role !== ROLE.ADMIN && (
						<Button ref={triggerRef} leftSection={<Plus aria-hidden />} onClick={modal.open}>
							{t('userPage.projects.addButton')}
						</Button>
					)}
				</div>
				{data.role === ROLE.ADMIN ? (
					<>
						<Text size='sm' className={classes.state}>
							{t('userPage.projects.allProjects')}
						</Text>
						{data.projects.length > 0 && <UserProjectsTable user={data} />}
					</>
				) : (
					<>
						<UserProjectsTable user={data} />
						<AddUserProjectModal user={data} opened={modalOpened} onClose={closeModal} />
					</>
				)}
			</>
		)
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<div className='flex flex-wrap items-end justify-between gap-4'>
				<PageIntro eyebrow={t('userPage.eyebrow')} title={t('userPage.title')} description={t('userPage.description')} titleSize='h2' />
				{data && data.id !== me?.id && (
					<Button variant='light' color='red' leftSection={<Trash aria-hidden />} onClick={deleteModal.open}>
						{t('userPage.deleteButton')}
					</Button>
				)}
			</div>
			{renderContent()}
			<DeleteUserModal
				opened={deleteOpened}
				user={data ?? null}
				onClose={deleteModal.close}
				onDeleted={() => {
					deleteModal.close()
					void navigate({ to: '/admin/users', search: true })
				}}
			/>
		</div>
	)
}

export default UserPage
