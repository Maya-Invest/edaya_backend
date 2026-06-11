import type { Crud } from '$lib/components/school/drawer-constants';
import type {
	AbsenceRecord,
	Activity,
	Deadline,
	Evaluation,
	Fee,
	Guardian,
	HealthRecord,
	Incident,
	PedagogicalNote,
	PlanningEvent,
	Resource,
	SchoolYearEvent,
	StaffMember,
	StaffRole,
	Student,
	StudentBilling,
	Subject,
} from '$lib/types/school';

export interface DetailDataSnapshot {
	students: Student[];
	guardians: Guardian[];
	staff: StaffMember[];
	subjects: Subject[];
	planning: PlanningEvent[];
	evaluations: Evaluation[];
	activities: Activity[];
	deadlines: Deadline[];
	incidents: Incident[];
	schoolYearEvents: SchoolYearEvent[];
	billing: StudentBilling[];
	fees: Fee[];
	healthRecords: Record<string, HealthRecord>;
	pedagogicalNotes: PedagogicalNote[];
	absences: AbsenceRecord[];
	resources: Resource[];
	roleCrudMatrix: Partial<Record<StaffRole, Record<string, Record<Crud, boolean>>>>;
	roleEnabledPermissions: Partial<Record<StaffRole, Record<string, boolean>>>;
}

class DetailDataContext {
	students = $state<Student[]>([]);
	guardians = $state<Guardian[]>([]);
	staff = $state<StaffMember[]>([]);
	subjects = $state<Subject[]>([]);
	planning = $state<PlanningEvent[]>([]);
	evaluations = $state<Evaluation[]>([]);
	activities = $state<Activity[]>([]);
	deadlines = $state<Deadline[]>([]);
	incidents = $state<Incident[]>([]);
	schoolYearEvents = $state<SchoolYearEvent[]>([]);
	billing = $state<StudentBilling[]>([]);
	fees = $state<Fee[]>([]);
	healthRecords = $state<Record<string, HealthRecord>>({});
	pedagogicalNotes = $state<PedagogicalNote[]>([]);
	absences = $state<AbsenceRecord[]>([]);
	resources = $state<Resource[]>([]);
	roleCrudMatrix = $state<Partial<Record<StaffRole, Record<string, Record<Crud, boolean>>>>>({});
	roleEnabledPermissions = $state<Partial<Record<StaffRole, Record<string, boolean>>>>({});
	ready = $state(false);

	hydrate(snapshot: DetailDataSnapshot) {
		this.students = snapshot.students;
		this.guardians = snapshot.guardians;
		this.staff = snapshot.staff;
		this.subjects = snapshot.subjects;
		this.planning = snapshot.planning;
		this.evaluations = snapshot.evaluations;
		this.activities = snapshot.activities;
		this.deadlines = snapshot.deadlines;
		this.incidents = snapshot.incidents;
		this.schoolYearEvents = snapshot.schoolYearEvents;
		this.billing = snapshot.billing;
		this.fees = snapshot.fees;
		this.healthRecords = snapshot.healthRecords;
		this.pedagogicalNotes = snapshot.pedagogicalNotes;
		this.absences = snapshot.absences;
		this.resources = snapshot.resources;
		this.roleCrudMatrix = snapshot.roleCrudMatrix;
		this.roleEnabledPermissions = snapshot.roleEnabledPermissions;
		this.ready = true;
	}

	reset() {
		this.students = [];
		this.guardians = [];
		this.staff = [];
		this.subjects = [];
		this.planning = [];
		this.evaluations = [];
		this.activities = [];
		this.deadlines = [];
		this.incidents = [];
		this.schoolYearEvents = [];
		this.billing = [];
		this.fees = [];
		this.healthRecords = {};
		this.pedagogicalNotes = [];
		this.absences = [];
		this.resources = [];
		this.roleCrudMatrix = {};
		this.roleEnabledPermissions = {};
		this.ready = false;
	}
}

export const detailDataContext = new DetailDataContext();
