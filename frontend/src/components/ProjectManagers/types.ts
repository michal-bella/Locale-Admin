import { type ProjectMember } from '@locale/shared'

export type ProjectManagersProps = {
	/** Members of the project; only those with the MANAGER role are shown. */
	members: ProjectMember[]
}
