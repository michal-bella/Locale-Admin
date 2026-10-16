import { ErrorComponent, type ErrorComponentProps } from '@tanstack/react-router'

import { ForbiddenError } from '@/lib/forbiddenError'
import ForbiddenPage from '@/pages/ForbiddenPage/ForbiddenPage'

/** `errorComponent` for role-guarded routes: 403 page for `ForbiddenError`, the router default for anything else. */
const RouteError = ({ error }: ErrorComponentProps) => (error instanceof ForbiddenError ? <ForbiddenPage /> : <ErrorComponent error={error} />)

export default RouteError
