import type { DetailDataSnapshot } from '$lib/detail-data/context.svelte';
import { loadAccessRolesData } from '$lib/api/access-roles-data';
import { fetchAssessmentsSources, mapAllEvaluations } from '$lib/api/assessments-data';
import { loadFinanceData } from '$lib/api/finance-data';
import { loadPeopleData } from '$lib/api/people-data';
import { fetchPlanningSources, mapAllPlanningEvents, mapResources } from '$lib/api/planning-data';
import { fetchActivities } from '$lib/api/prototype-data';
import { fetchHomeworkSources, mapDeadlines } from '$lib/api/homework-data';
import { loadAbsences, loadCalendarEvents, loadIncidents } from '$lib/api/school-life-data';
import { fetchStaffMembers } from '$lib/api/staff-data';
import { loadStudent360Data } from '$lib/api/student-360-data';
import { fetchClassSubjectsSources, mapAllClassSubjects } from '$lib/api/subjects-data';
import { queryClient } from '$lib/queries/client';

export async function getDetailDataSnapshot(classGroupIds: string[]): Promise<DetailDataSnapshot> {
	const client = queryClient();
	const [
		people,
		staff,
		subjectSources,
		finance,
		activities,
		deadlines,
		schoolYearEvents,
		incidents,
		absences,
		student360,
		planningSources,
		assessmentSources,
		accessRoles,
	] = await Promise.all([
		loadPeopleData(client),
		fetchStaffMembers(client),
		fetchClassSubjectsSources(client),
		loadFinanceData(client),
		fetchActivities(),
		fetchHomeworkSources(client).then(sources => mapDeadlines(undefined, sources)),
		loadCalendarEvents(client),
		loadIncidents(client),
		loadAbsences(client),
		loadStudent360Data(client),
		fetchPlanningSources(client),
		fetchAssessmentsSources(client),
		loadAccessRolesData(client),
	]);

	return {
		students: people.students,
		guardians: people.guardians,
		staff,
		subjects: mapAllClassSubjects(subjectSources),
		planning: mapAllPlanningEvents(planningSources, classGroupIds),
		evaluations: mapAllEvaluations(assessmentSources, classGroupIds),
		activities,
		deadlines,
		incidents,
		schoolYearEvents,
		billing: finance.billing,
		fees: finance.fees,
		healthRecords: student360.healthRecords,
		pedagogicalNotes: student360.pedagogicalNotes,
		absences,
		resources: mapResources(planningSources.resourcesRaw),
		roleCrudMatrix: accessRoles.roleCrudMatrix,
		roleEnabledPermissions: accessRoles.roleEnabledPermissions,
	};
}
