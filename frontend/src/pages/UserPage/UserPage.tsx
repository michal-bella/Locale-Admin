import { Button, Skeleton, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useParams } from '@tanstack/react-router'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import { useAdminUserQuery } from '@/api/adminUsers/adminUserQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import AddUserProjectModal from '@/components/AddUserProjectModal/AddUserProjectModal'
import { Plus } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'
import UserCard from '@/components/UserCard/UserCard'
import UserProjectsTable from '@/components/UserProjectsTable/UserProjectsTable'

import classes from './UserPage.module.css'

/** Detail of one user (ADMIN only): account card and the projects they are a member of, with adding and removing. No Figma, same look as Používatelia. */
const UserPage = () => {
	const { t } = useTranslation()
	const { userId } = useParams({ from: '/_authenticated/_app/admin/users/$userId' })
	const { data, isPending, isError, error, refetch, isRefetching } = useAdminUserQuery(userId)
	const [modalOpened, modal] = useDisclosure(false)
	const triggerRef = useRef<HTMLButtonElement>(null)

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
						<ButtonLink to='/admin/users' variant='default' mt='md'>
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
					<Button ref={triggerRef} leftSection={<Plus aria-hidden />} onClick={modal.open}>
						{t('userPage.projects.addButton')}
					</Button>
				</div>
				<UserProjectsTable user={data} />
				<AddUserProjectModal user={data} opened={modalOpened} onClose={closeModal} />
			</>
		)
	}

	return (
		<div className='mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-8'>
			<PageIntro eyebrow={t('userPage.eyebrow')} title={t('userPage.title')} description={t('userPage.description')} titleSize='h2' />
			{renderContent()}
		</div>
	)
}

export default UserPage
