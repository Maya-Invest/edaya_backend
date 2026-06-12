import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { StaffMember, StaffRole, SubjectCategory } from '$lib/types/school';

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

type StaffRaw = components['schemas']['StaffMember'];
type RoleAssignmentRaw = components['schemas']['StaffRoleAssignment'];
type ClassGroupRaw = components['schemas']['ClassGroup'];
type AssignmentRaw = components['schemas']['StaffAssignment'];
type ClassSubjectRaw = components['schemas']['ClassSubject'];
type SubjectRaw = components['schemas']['Subject'];

const ROLE_ID_TO_STAFF_ROLE: Record<string, StaffRole> = {
	'role-director': 'directeur',
	'role-coordinator': 'prof_principal',
	'role-educator': 'educateur',
	'role-teacher': 'professeur',
	'directeur': 'directeur',
	'director': 'directeur',
	'prof_principal': 'prof_principal',
	'principal_teacher': 'prof_principal',
	'educateur': 'educateur',
	'educator': 'educateur',
};

function inferSubjectCategory(name: string, code?: string | null): SubjectCategory {
	const label = `${name} ${code ?? ''}`.toLowerCase();

	if (/english|anglais|espagnol|allemand|langue/.test(label)) {
		return 'Langues';
	}
	if (/sport|eps|physique/.test(label) && !/chimie|physics/.test(label)) {
		return 'Sport';
	}
	if (/art|musique|dessin/.test(label)) {
		return 'Arts';
	}
	if (/histoire|géographie|geography|humanities/.test(label)) {
		return 'Sciences humaines';
	}
	if (/français|literature|littér|lettre|french/.test(label)) {
		return 'Littéraire';
	}

	return 'Scientifique';
}

function categoryToDepartment(category: SubjectCategory): string {
	switch (category) {
		case 'Littéraire':
		case 'Sciences humaines':
			return 'Lettres';
		case 'Langues':
			return 'Langues';
		case 'Sport':
			return 'Sport';
		case 'Arts':
			return 'Arts';
		default:
			return 'Sciences';
	}
}

export function mapStaffRole(
	member: StaffRaw,
	roleAssignments: RoleAssignmentRaw[],
): StaffRole {
	const assignment = roleAssignments.find(
		entry => entry.staffId === member.id && entry.status !== 'inactive',
	);
	const roleId = assignment?.roleIds[0];
	if (roleId && ROLE_ID_TO_STAFF_ROLE[roleId]) {
		return ROLE_ID_TO_STAFF_ROLE[roleId];
	}
	return 'professeur';
}

function catalogSubjectIdsForStaff(
	staffId: string,
	assignments: AssignmentRaw[],
	classSubjects: ClassSubjectRaw[],
): string[] {
	const subjectIds = new Set<string>();
	for (const assignment of assignments) {
		if (assignment.staffId !== staffId || !assignment.classSubjectId) {
			continue;
		}
		const offering = classSubjects.find(entry => entry.id === assignment.classSubjectId);
		if (offering?.subjectId) {
			subjectIds.add(offering.subjectId);
		}
	}
	return [...subjectIds];
}

function subjectLabelsForCatalogIds(catalogIds: string[], subjects: SubjectRaw[]): string[] {
	return catalogIds.map(
		id => subjects.find(subject => subject.id === id)?.name ?? id,
	);
}

export function mapDepartment(
	role: StaffRole,
	staffId: string,
	assignments: AssignmentRaw[],
	catalogSubjectIds: string[],
	subjects: SubjectRaw[],
): string {
	if (role === 'directeur') {
		return 'Direction';
	}
	if (role === 'educateur') {
		return 'Vie scolaire';
	}

	const specialized = assignments.find(
		entry => entry.staffId === staffId && entry.responsibility && entry.responsibility !== 'Teacher',
	);
	if (specialized?.responsibility === 'Mathematics') {
		return 'Sciences';
	}

	if (catalogSubjectIds.length > 0) {
		const departments = [...new Set(catalogSubjectIds.map((subjectId) => {
			const subject = subjects.find(entry => entry.id === subjectId);
			return categoryToDepartment(
				inferSubjectCategory(subject?.name ?? subjectId, subject?.code),
			);
		}))];
		return departments.length === 1 ? departments[0]! : departments[0] ?? 'Sciences';
	}

	return 'Sciences';
}

export function mapStaffMembers(
	staffRaw: StaffRaw[],
	roleAssignmentsRaw: RoleAssignmentRaw[],
	classGroupsRaw: ClassGroupRaw[],
	assignmentsRaw: AssignmentRaw[],
	classSubjectsRaw: ClassSubjectRaw[] = [],
	subjectsRaw: SubjectRaw[] = [],
): StaffMember[] {
	return (staffRaw ?? []).map((member) => {
		const role = mapStaffRole(member, roleAssignmentsRaw);

		const classesTaught = (assignmentsRaw ?? [])
			.filter(entry => entry.staffId === member.id && entry.classGroupId)
			.map(entry => entry.classGroupId as string);

		const homeroomClass = (classGroupsRaw ?? []).find(entry => entry.homeroomStaffId === member.id);
		const mainClassId = homeroomClass?.id;
		if (mainClassId && !classesTaught.includes(mainClassId)) {
			classesTaught.push(mainClassId);
		}

		const catalogSubjectIds = catalogSubjectIdsForStaff(
			member.id,
			assignmentsRaw ?? [],
			classSubjectsRaw,
		);

		return {
			id: member.id,
			name: `${member.firstName} ${member.lastName}`,
			initials: `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`,
			role,
			department: mapDepartment(
				role,
				member.id,
				assignmentsRaw ?? [],
				catalogSubjectIds,
				subjectsRaw,
			),
			email: member.email ?? '',
			classes: classesTaught,
			mainClassId,
			subjectsTaught: catalogSubjectIds,
			subjectLabels: subjectLabelsForCatalogIds(catalogSubjectIds, subjectsRaw),
		};
	});
}

export async function fetchStaffMembers(client: SchoolClient): Promise<StaffMember[]> {
	const [staffRaw, roleAssignmentsRaw, classGroupsRaw, assignmentsRaw, classSubjectsRaw, subjectsRaw]
		= await Promise.all([
			client.entities.staffMembers.list({}),
			client.entities.staffRoleAssignments.list({}),
			client.entities.classGroups.list({}),
			client.entities.staffAssignments.list({}),
			client.entities.classSubjects.list({}),
			client.entities.subjects.list({}),
		]);

	return mapStaffMembers(
		staffRaw ?? [],
		roleAssignmentsRaw ?? [],
		classGroupsRaw ?? [],
		assignmentsRaw ?? [],
		classSubjectsRaw ?? [],
		subjectsRaw ?? [],
	);
}

export async function fetchStaffMemberById(client: SchoolClient, staffId: string): Promise<StaffMember | null> {
	const members = await fetchStaffMembers(client);
	return members.find(member => member.id === staffId) ?? null;
}
