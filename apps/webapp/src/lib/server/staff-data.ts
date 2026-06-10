import { apiFetch } from '$lib/server/api-client';
import type { components } from '$lib/api/schema';
import type { StaffMember, StaffRole } from '$lib/data/school';

type StaffRaw = components['schemas']['StaffMember'];
type RoleAssignmentRaw = components['schemas']['StaffRoleAssignment'];
type ClassGroupRaw = components['schemas']['ClassGroup'];
type AssignmentRaw = components['schemas']['StaffAssignment'];

function mapStaffRole(
	member: StaffRaw,
	roleAssignments: RoleAssignmentRaw[],
): StaffRole {
	const assignment = roleAssignments.find((entry) => entry.staffId === member.id);
	if (assignment && assignment.roleIds.length > 0) {
		const assignedRole = assignment.roleIds[0];
		if (assignedRole === 'directeur' || assignedRole === 'director' || assignedRole === 'role-director') {
			return 'directeur';
		}
		if (assignedRole === 'prof_principal' || assignedRole === 'principal_teacher' || assignedRole === 'role-coordinator') {
			return 'prof_principal';
		}
		if (assignedRole === 'educateur' || assignedRole === 'educator' || assignedRole === 'role-educator') {
			return 'educateur';
		}
	}

	if (member.id === 'st5') return 'directeur';
	if (member.id === 'st3') return 'prof_principal';
	if (member.id === 'st7') return 'educateur';
	return 'professeur';
}

function mapDepartment(member: StaffRaw, role: StaffRole): string {
	if (role === 'directeur') return 'Direction';
	if (role === 'educateur') return 'Vie scolaire';
	if (member.id === 'st3') return 'Lettres';
	return 'Sciences';
}

export function mapStaffMembers(
	staffRaw: StaffRaw[],
	roleAssignmentsRaw: RoleAssignmentRaw[],
	classGroupsRaw: ClassGroupRaw[],
	assignmentsRaw: AssignmentRaw[],
): StaffMember[] {
	return (staffRaw ?? []).map((member) => {
		const role = mapStaffRole(member, roleAssignmentsRaw);

		const classesTaught = (assignmentsRaw ?? [])
			.filter((entry) => entry.staffId === member.id && entry.classGroupId)
			.map((entry) => entry.classGroupId as string);

		const homeroomClass = (classGroupsRaw ?? []).find((entry) => entry.homeroomStaffId === member.id);
		const mainClassId = homeroomClass?.id;
		if (mainClassId && !classesTaught.includes(mainClassId)) {
			classesTaught.push(mainClassId);
		}

		const subjectsTaught = (assignmentsRaw ?? [])
			.filter((entry) => entry.staffId === member.id && entry.classSubjectId)
			.map((entry) => entry.classSubjectId as string);

		if (member.id === 'st3' && subjectsTaught.length === 0) {
			subjectsTaught.push('subj-6-fr');
		}
		else if (member.id === 'st1' && subjectsTaught.length === 0) {
			subjectsTaught.push('subj-6-math', 'subj-6-sci');
		}

		return {
			id: member.id,
			name: `${member.firstName} ${member.lastName}`,
			initials: `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`,
			role,
			department: mapDepartment(member, role),
			email: member.email ?? '',
			classes: classesTaught,
			mainClassId,
			subjectsTaught,
		};
	});
}

async function fetchStaffSources() {
	const [staffRaw, roleAssignmentsRaw, classGroupsRaw, assignmentsRaw] = await Promise.all([
		apiFetch<StaffRaw[]>('/api/core/entities/staff-members/list', {
			method: 'POST',
			body: JSON.stringify({}),
		}),
		apiFetch<RoleAssignmentRaw[]>('/api/core/entities/staff-role-assignments/list', {
			method: 'POST',
			body: JSON.stringify({}),
		}),
		apiFetch<ClassGroupRaw[]>('/api/core/entities/class-groups/list', {
			method: 'POST',
			body: JSON.stringify({}),
		}),
		apiFetch<AssignmentRaw[]>('/api/core/entities/staff-assignments/list', {
			method: 'POST',
			body: JSON.stringify({}),
		}),
	]);

	return mapStaffMembers(staffRaw, roleAssignmentsRaw, classGroupsRaw, assignmentsRaw);
}

export async function fetchStaffMembers(): Promise<StaffMember[]> {
	return fetchStaffSources();
}

export async function fetchStaffMemberById(staffId: string): Promise<StaffMember | null> {
	const members = await fetchStaffSources();
	return members.find((member) => member.id === staffId) ?? null;
}
