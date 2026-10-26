import { emailSchema, ERROR_CODE, PERSON_NAME_MAX_LENGTH } from '@locale/shared'

import { Prisma, type User } from '../generated/prisma/client'
import { ROLE } from '../generated/prisma/enums'
import { AppError } from '../lib/errors'
import { type GoogleIdentity } from '../lib/googleOidc'
import { type PrismaClient } from '../lib/prisma'

import { type LoginResult, startSession } from './auth.service'
import { type SessionConfig } from './session.service'

const accountConflict = () => new AppError(409, ERROR_CODE.AUTH_ACCOUNT_CONFLICT, 'The email belongs to a user linked to another Google account')

const toPersonName = (value: string | undefined): string | undefined => value?.trim().slice(0, PERSON_NAME_MAX_LENGTH) || undefined

/**
 * Finds the user of a Google account: by the linked Google ID, else by the verified email (the account is linked to that user, so a
 * password user and their Google sign-in are one account), else creates a `USER` without projects and without a password.
 */
const findOrCreateUser = async (prisma: PrismaClient, sub: string, email: string, names: Pick<User, 'firstName' | 'lastName'>): Promise<User> => {
	const linked = await prisma.user.findUnique({ where: { googleSub: sub } })
	if (linked) {
		return linked
	}
	const byEmail = await prisma.user.findUnique({ where: { email } })
	if (byEmail) {
		if (byEmail.googleSub !== null) {
			throw accountConflict()
		}
		return prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: sub } })
	}
	try {
		return await prisma.user.create({ data: { email, googleSub: sub, role: ROLE.USER, ...names } })
	} catch (err) {
		// Two callbacks of the same account at once (double click): the other one created the user.
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
			const created = await prisma.user.findUnique({ where: { googleSub: sub } })
			if (created) {
				return created
			}
			throw accountConflict()
		}
		throw err
	}
}

/** Signs in a Google account; the first and last name are filled from Google only when the user has none. */
export const signInWithGoogle = async (prisma: PrismaClient, identity: GoogleIdentity, config: SessionConfig, previousToken?: string): Promise<LoginResult> => {
	if (!identity.emailVerified) {
		throw new AppError(403, ERROR_CODE.AUTH_EMAIL_NOT_VERIFIED, 'The Google account has no verified email')
	}
	const email = emailSchema.safeParse(identity.email)
	if (!email.success) {
		throw new AppError(400, ERROR_CODE.AUTH_OAUTH_FAILED, 'The Google account has an invalid email')
	}
	const names = { firstName: toPersonName(identity.givenName) ?? null, lastName: toPersonName(identity.familyName) ?? null }
	const user = await findOrCreateUser(prisma, identity.sub, email.data, names)
	if (!user.isActive) {
		throw new AppError(403, ERROR_CODE.AUTH_USER_BLOCKED, 'The user is blocked')
	}
	return startSession(prisma, user.id, config, previousToken, {
		...(user.firstName === null && names.firstName !== null && { firstName: names.firstName }),
		...(user.lastName === null && names.lastName !== null && { lastName: names.lastName }),
	})
}
