import * as client from 'openid-client'
import { z } from 'zod'

import { type GoogleConfig } from '../config/env'

const GOOGLE_ISSUER = new URL('https://accounts.google.com')

/** Random values of one sign-in attempt, kept in the `locale_oauth` cookie between the redirect to Google and the callback. */
export type OAuthChecks = {
	codeVerifier: string
	state: string
	nonce: string
}

export type GoogleIdentity = {
	sub: string
	email: string
	emailVerified: boolean
	givenName?: string
	familyName?: string
}

/** The Google part of the sign-in; integration tests replace it with a fake (`AppDeps.googleOidc`). */
export type GoogleOidc = {
	createAuthorizationUrl: (checks: OAuthChecks) => Promise<URL>
	/** Validates the query of the callback (`state`, PKCE, ID token with `nonce`) and returns who signed in. */
	exchangeCode: (callbackParams: URLSearchParams, checks: OAuthChecks) => Promise<GoogleIdentity>
}

const idTokenClaimsSchema = z.object({
	sub: z.string().min(1),
	email: z.string(),
	email_verified: z.boolean().optional(),
	given_name: z.string().optional(),
	family_name: z.string().optional(),
})

export const createOAuthChecks = (): OAuthChecks => ({
	codeVerifier: client.randomPKCECodeVerifier(),
	state: client.randomState(),
	nonce: client.randomNonce(),
})

export const createGoogleOidc = ({ clientId, clientSecret, redirectUri }: GoogleConfig): GoogleOidc => {
	let discovered: Promise<client.Configuration> | undefined
	// Lazy, so the backend starts while Google is unreachable; a failed discovery is retried on the next sign-in.
	const getConfiguration = () => {
		discovered ??= client.discovery(GOOGLE_ISSUER, clientId, undefined, client.ClientSecretPost(clientSecret)).catch((err: unknown) => {
			discovered = undefined
			throw err
		})
		return discovered
	}

	return {
		createAuthorizationUrl: async ({ codeVerifier, state, nonce }) =>
			client.buildAuthorizationUrl(await getConfiguration(), {
				redirect_uri: redirectUri,
				scope: 'openid email profile',
				code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
				code_challenge_method: 'S256',
				state,
				nonce,
				prompt: 'select_account',
			}),
		exchangeCode: async (callbackParams, { codeVerifier, state, nonce }) => {
			// The registered redirect URI, not the request's Host: behind the Vite proxy and nginx the Host differs.
			const callbackUrl = new URL(redirectUri)
			callbackUrl.search = callbackParams.toString()
			const tokens = await client.authorizationCodeGrant(await getConfiguration(), callbackUrl, {
				pkceCodeVerifier: codeVerifier,
				expectedState: state,
				expectedNonce: nonce,
			})
			const claims = idTokenClaimsSchema.parse(tokens.claims())
			return {
				sub: claims.sub,
				email: claims.email,
				emailVerified: claims.email_verified === true,
				givenName: claims.given_name,
				familyName: claims.family_name,
			}
		},
	}
}
