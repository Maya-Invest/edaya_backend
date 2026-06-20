export interface CalendarListFilters {
	q: string;
	type: string;
}

const CALENDAR_DEFAULTS: CalendarListFilters = {
	q: '',
	type: 'all',
};

export function readCalendarListFilters(url: URL): CalendarListFilters {
	return {
		q: url.searchParams.get('q') ?? CALENDAR_DEFAULTS.q,
		type: url.searchParams.get('type') ?? CALENDAR_DEFAULTS.type,
	};
}

export function writeCalendarListFilters(url: URL, filters: CalendarListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.type !== 'all')
		next.searchParams.set('type', filters.type);
	else
		next.searchParams.delete('type');

	return `${next.pathname}${next.search}`;
}

export interface ConfigSubjectListFilters {
	q: string;
	mode: string;
}

const CONFIG_SUBJECT_DEFAULTS: ConfigSubjectListFilters = {
	q: '',
	mode: 'level',
};

export function readConfigSubjectListFilters(url: URL): ConfigSubjectListFilters {
	const mode = url.searchParams.get('mode') ?? CONFIG_SUBJECT_DEFAULTS.mode;
	return {
		q: url.searchParams.get('q') ?? CONFIG_SUBJECT_DEFAULTS.q,
		mode: mode === 'category' ? 'category' : 'level',
	};
}

export function writeConfigSubjectListFilters(url: URL, filters: ConfigSubjectListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.mode !== 'level')
		next.searchParams.set('mode', filters.mode);
	else
		next.searchParams.delete('mode');

	return `${next.pathname}${next.search}`;
}

export interface TeachingListFilters {
	q: string;
}

const TEACHING_DEFAULTS: TeachingListFilters = {
	q: '',
};

export function readTeachingListFilters(url: URL): TeachingListFilters {
	return {
		q: url.searchParams.get('q') ?? TEACHING_DEFAULTS.q,
	};
}

export function writeTeachingListFilters(url: URL, filters: TeachingListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	return `${next.pathname}${next.search}`;
}

export interface PlanningListFilters {
	q: string;
}

const PLANNING_DEFAULTS: PlanningListFilters = {
	q: '',
};

export function readPlanningListFilters(url: URL): PlanningListFilters {
	return {
		q: url.searchParams.get('q') ?? PLANNING_DEFAULTS.q,
	};
}

export function writePlanningListFilters(url: URL, filters: PlanningListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	return `${next.pathname}${next.search}`;
}

export interface ClassStudentListFilters {
	q: string;
	status: string;
}

const CLASS_DEFAULTS: ClassStudentListFilters = {
	q: '',
	status: 'all',
};

export function readClassStudentListFilters(url: URL): ClassStudentListFilters {
	return {
		q: url.searchParams.get('q') ?? CLASS_DEFAULTS.q,
		status: url.searchParams.get('status') ?? CLASS_DEFAULTS.status,
	};
}

export function writeClassStudentListFilters(url: URL, filters: ClassStudentListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.status !== 'all')
		next.searchParams.set('status', filters.status);
	else
		next.searchParams.delete('status');

	return `${next.pathname}${next.search}`;
}

export interface ActivityListFilters {
	q: string;
	category: string;
}

const ACTIVITY_DEFAULTS: ActivityListFilters = {
	q: '',
	category: 'all',
};

export function readActivityListFilters(url: URL): ActivityListFilters {
	return {
		q: url.searchParams.get('q') ?? ACTIVITY_DEFAULTS.q,
		category: url.searchParams.get('category') ?? ACTIVITY_DEFAULTS.category,
	};
}

export function writeActivityListFilters(url: URL, filters: ActivityListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.category !== 'all')
		next.searchParams.set('category', filters.category);
	else
		next.searchParams.delete('category');

	return `${next.pathname}${next.search}`;
}

export interface StudentListFilters {
	q: string;
	class: string;
	status: string;
}

const DEFAULTS: StudentListFilters = {
	q: '',
	class: 'all',
	status: 'all',
};

export function readStudentListFilters(url: URL): StudentListFilters {
	return {
		q: url.searchParams.get('q') ?? DEFAULTS.q,
		class: url.searchParams.get('class') ?? DEFAULTS.class,
		status: url.searchParams.get('status') ?? DEFAULTS.status,
	};
}

export function writeStudentListFilters(url: URL, filters: StudentListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.class !== 'all')
		next.searchParams.set('class', filters.class);
	else
		next.searchParams.delete('class');

	if (filters.status !== 'all')
		next.searchParams.set('status', filters.status);
	else
		next.searchParams.delete('status');

	return `${next.pathname}${next.search}`;
}

export interface ClassReportCardListFilters {
	q: string;
	status: string;
}

const CLASS_REPORT_CARD_DEFAULTS: ClassReportCardListFilters = {
	q: '',
	status: 'all',
};

export function readClassReportCardListFilters(url: URL): ClassReportCardListFilters {
	return {
		q: url.searchParams.get('q') ?? CLASS_REPORT_CARD_DEFAULTS.q,
		status: url.searchParams.get('status') ?? CLASS_REPORT_CARD_DEFAULTS.status,
	};
}

export function writeClassReportCardListFilters(url: URL, filters: ClassReportCardListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.status !== 'all')
		next.searchParams.set('status', filters.status);
	else
		next.searchParams.delete('status');

	return `${next.pathname}${next.search}`;
}

export interface PaymentListFilters {
	q: string;
	status: string;
	class: string;
}

const PAYMENT_DEFAULTS: PaymentListFilters = {
	q: '',
	status: 'all',
	class: 'all',
};

export function readPaymentListFilters(url: URL): PaymentListFilters {
	return {
		q: url.searchParams.get('q') ?? PAYMENT_DEFAULTS.q,
		status: url.searchParams.get('status') ?? PAYMENT_DEFAULTS.status,
		class: url.searchParams.get('class') ?? PAYMENT_DEFAULTS.class,
	};
}

export function writePaymentListFilters(url: URL, filters: PaymentListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.status !== 'all')
		next.searchParams.set('status', filters.status);
	else
		next.searchParams.delete('status');

	if (filters.class !== 'all')
		next.searchParams.set('class', filters.class);
	else
		next.searchParams.delete('class');

	return `${next.pathname}${next.search}`;
}

export interface ReportCardDefinitionListFilters {
	q: string;
	status: string;
}

const REPORT_CARD_DEF_DEFAULTS: ReportCardDefinitionListFilters = {
	q: '',
	status: 'all',
};

export function readReportCardDefinitionListFilters(url: URL): ReportCardDefinitionListFilters {
	return {
		q: url.searchParams.get('q') ?? REPORT_CARD_DEF_DEFAULTS.q,
		status: url.searchParams.get('status') ?? REPORT_CARD_DEF_DEFAULTS.status,
	};
}

export function writeReportCardDefinitionListFilters(url: URL, filters: ReportCardDefinitionListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.status !== 'all')
		next.searchParams.set('status', filters.status);
	else
		next.searchParams.delete('status');

	return `${next.pathname}${next.search}`;
}

export interface RoleListFilters {
	q: string;
}

const ROLE_DEFAULTS: RoleListFilters = {
	q: '',
};

export function readRoleListFilters(url: URL): RoleListFilters {
	return {
		q: url.searchParams.get('q') ?? ROLE_DEFAULTS.q,
	};
}

export function writeRoleListFilters(url: URL, filters: RoleListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	return `${next.pathname}${next.search}`;
}

export interface GradeScaleListFilters {
	q: string;
}

const GRADE_SCALE_DEFAULTS: GradeScaleListFilters = {
	q: '',
};

export function readGradeScaleListFilters(url: URL): GradeScaleListFilters {
	return {
		q: url.searchParams.get('q') ?? GRADE_SCALE_DEFAULTS.q,
	};
}

export function writeGradeScaleListFilters(url: URL, filters: GradeScaleListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	return `${next.pathname}${next.search}`;
}

export interface ClassGroupListFilters {
	q: string;
}

const CLASS_GROUP_DEFAULTS: ClassGroupListFilters = {
	q: '',
};

export function readClassGroupListFilters(url: URL): ClassGroupListFilters {
	return {
		q: url.searchParams.get('q') ?? CLASS_GROUP_DEFAULTS.q,
	};
}

export function writeClassGroupListFilters(url: URL, filters: ClassGroupListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	return `${next.pathname}${next.search}`;
}

export interface AcademicAdminListFilters {
	q: string;
}

const ACADEMIC_ADMIN_DEFAULTS: AcademicAdminListFilters = {
	q: '',
};

export function readAcademicAdminListFilters(url: URL): AcademicAdminListFilters {
	return {
		q: url.searchParams.get('q') ?? ACADEMIC_ADMIN_DEFAULTS.q,
	};
}

export function writeAcademicAdminListFilters(url: URL, filters: AcademicAdminListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	return `${next.pathname}${next.search}`;
}

export interface ResourceListFilters {
	q: string;
	status: string;
}

const RESOURCE_DEFAULTS: ResourceListFilters = {
	q: '',
	status: 'all',
};

export function readResourceListFilters(url: URL): ResourceListFilters {
	return {
		q: url.searchParams.get('q') ?? RESOURCE_DEFAULTS.q,
		status: url.searchParams.get('status') ?? RESOURCE_DEFAULTS.status,
	};
}

export function writeResourceListFilters(url: URL, filters: ResourceListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.status !== 'all')
		next.searchParams.set('status', filters.status);
	else
		next.searchParams.delete('status');

	return `${next.pathname}${next.search}`;
}

export interface EducatorDashboardListFilters {
	q: string;
	tab: string;
}

const EDUCATOR_DASHBOARD_DEFAULTS: EducatorDashboardListFilters = {
	q: '',
	tab: 'schoollife',
};

export function readEducatorDashboardListFilters(url: URL): EducatorDashboardListFilters {
	const tab = url.searchParams.get('tab') ?? EDUCATOR_DASHBOARD_DEFAULTS.tab;
	return {
		q: url.searchParams.get('q') ?? EDUCATOR_DASHBOARD_DEFAULTS.q,
		tab: tab === 'grades' ? 'grades' : 'schoollife',
	};
}

export function writeEducatorDashboardListFilters(url: URL, filters: EducatorDashboardListFilters): string {
	const next = new URL(url);

	if (filters.q.trim())
		next.searchParams.set('q', filters.q.trim());
	else
		next.searchParams.delete('q');

	if (filters.tab !== 'schoollife')
		next.searchParams.set('tab', filters.tab);
	else
		next.searchParams.delete('tab');

	return `${next.pathname}${next.search}`;
}
