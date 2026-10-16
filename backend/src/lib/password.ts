import { randomBytes } from 'node:crypto'

import argon2 from 'argon2'

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, { type: argon2.argon2id })

export const verifyPassword = (passwordHash: string, password: string): Promise<boolean> => argon2.verify(passwordHash, password)

let dummyPasswordHash: Promise<string> | undefined

/** Hash of a random password; verifying against it for unknown emails keeps login timing close to a real wrong-password check. */
export const getDummyPasswordHash = (): Promise<string> => {
	dummyPasswordHash ??= hashPassword(randomBytes(32).toString('base64url'))
	return dummyPasswordHash
}
