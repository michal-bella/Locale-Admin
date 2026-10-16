import { type ErrorComponentProps } from '@tanstack/react-router'

import { ForbiddenError } from '@/lib/forbiddenError'
import ErrorPage from '@/pages/ErrorPage/ErrorPage'
import ForbiddenPage from '@/pages/ForbiddenPage/ForbiddenPage'

/** `errorComponent` for role-guarded routes inside `AppLayout`: 403 page for `ForbiddenError`, the generic error page for anything else. */
const RouteError = ({ error }: ErrorComponentProps) => (error instanceof ForbiddenError ? <ForbiddenPage /> : <ErrorPage error={error} inAppLayout />)

export default RouteError
