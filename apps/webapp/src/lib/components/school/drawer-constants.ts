import type { Guardian, Subject, StaffRole, ActivityEnrollmentStatus, Incident } from '$lib/data/school';
import type { DrawerItem } from './drawer-types';
import { BADGE, BADGE_DANGER, BADGE_INFO, BADGE_WARN } from '$lib/ui-tones';

const drawerBadge = BADGE_INFO;

export const kindStyle: Record<NonNullable<DrawerItem>['kind'], string> = {
	student: drawerBadge,
	subject: drawerBadge,
	planning: drawerBadge,
	evaluation: drawerBadge,
	guardian: drawerBadge,
	staff: drawerBadge,
	deadline: drawerBadge,
	billing: drawerBadge,
	fee: drawerBadge,
	schoolYearEvent: drawerBadge,
	incident: BADGE_DANGER,
	role: drawerBadge,
	level: drawerBadge,
	activity: drawerBadge,
	reportCardDefinition: drawerBadge,
	reportCardResult: drawerBadge,
};

export const kindLabelKey: Record<NonNullable<DrawerItem>['kind'], string> = {
	student: 'drawer.student',
	subject: 'drawer.subject',
	planning: 'drawer.planning',
	evaluation: 'drawer.evaluation',
	guardian: 'drawer.guardian',
	staff: 'drawer.staff',
	deadline: 'drawer.deadline',
	billing: 'drawer.invoice',
	fee: 'drawer.fee',
	schoolYearEvent: 'drawer.schoolYearEvent',
	incident: 'events.schoolLife',
	role: 'roles.title',
	level: 'drawer.level',
	activity: 'drawer.activity',
	reportCardDefinition: 'drawer.reportCardDefinition',
	reportCardResult: 'drawer.reportCardResult',
};

export const relationKey: Record<Guardian['relation'], string> = {
	'Mother': 'guardian.relation.Mother',
	'Father': 'guardian.relation.Father',
	'Legal guardian': 'guardian.relation.LegalGuardian',
};

export const dotByColor: Record<Subject['color'], string> = {
	mint: 'bg-accent',
	sky: 'bg-accent/60',
	warm: 'bg-muted-foreground/40',
};

export const ENROLL_STATUS_STYLE: Record<ActivityEnrollmentStatus, string> = {
	approved: `${BADGE} border-border`,
	pending: `${BADGE_WARN} border-highlight/20`,
	denied: `${BADGE_DANGER} border-destructive/20`,
};

export const ENROLL_STATUS_LABEL: Record<ActivityEnrollmentStatus, string> = {
	approved: 'Autorisé',
	pending: 'En attente',
	denied: 'Refusé',
};

export const ENROLL_NEXT: Record<ActivityEnrollmentStatus, ActivityEnrollmentStatus> = {
	approved: 'pending',
	pending: 'denied',
	denied: 'approved',
};

export const incidentSevTone: Record<Incident['severity'], string> = {
	low: BADGE,
	medium: BADGE_WARN,
	high: BADGE_DANGER,
};

export const incidentCatTone: Record<Incident['category'], string> = {
	Behavior: BADGE_WARN,
	Tardiness: BADGE,
	Conflict: BADGE_DANGER,
	Other: BADGE,
};

export type StaffPermScope = 'global' | 'class' | 'subject';

export interface StaffPerm {
	key: string;
	category: string;
	label: string;
	description: string;
	scopes: StaffPermScope[];
}

export const STAFF_PERMISSIONS: StaffPerm[] = [
	{
		key: 'grades.edit',
		category: 'Pédagogie',
		label: 'Saisir / modifier les notes',
		description: 'Création et édition des évaluations et notes.',
		scopes: ['class', 'subject'],
	},
	{
		key: 'grades.view',
		category: 'Pédagogie',
		label: 'Consulter les notes & moyennes',
		description: 'Lecture des notes et moyennes.',
		scopes: ['global', 'class', 'subject'],
	},
	{
		key: 'reports.edit',
		category: 'Pédagogie',
		label: 'Bulletins & orientation',
		description: 'Édition des bulletins et décisions d\'orientation.',
		scopes: ['global', 'class'],
	},
	{
		key: 'records.edit',
		category: 'Dossiers',
		label: 'Dossiers élèves',
		description: 'Lecture / écriture des dossiers administratifs.',
		scopes: ['global', 'class'],
	},
	{
		key: 'life.absences',
		category: 'Vie scolaire',
		label: 'Absences',
		description: 'Saisie et suivi des absences.',
		scopes: ['global', 'class'],
	},
	{
		key: 'life.tardiness',
		category: 'Vie scolaire',
		label: 'Retards',
		description: 'Enregistrement des retards.',
		scopes: ['global', 'class'],
	},
	{
		key: 'life.discipline',
		category: 'Vie scolaire',
		label: 'Discipline & incidents',
		description: 'Création et suivi des incidents disciplinaires.',
		scopes: ['global', 'class'],
	},
	{
		key: 'staff.manage',
		category: 'Administration',
		label: 'Gestion du personnel',
		description: 'Ajout, retrait et affectation du personnel.',
		scopes: ['global'],
	},
	{
		key: 'finance.manage',
		category: 'Administration',
		label: 'Finance & facturation',
		description: 'Frais, facturation et paiements.',
		scopes: ['global'],
	},
	{
		key: 'config.school',
		category: 'Administration',
		label: 'Configuration de l\'école',
		description: 'Matières, ressources, calendrier et paramètres.',
		scopes: ['global'],
	},
];

export const STAFF_SCOPE_LABEL: Record<StaffPermScope, string> = {
	global: 'Globale',
	class: 'Classe',
	subject: 'Matière',
};

export const STAFF_SCOPE_TONE: Record<StaffPermScope, string> = {
	global: `${BADGE_INFO} border-primary/20`,
	class: `${BADGE} border-border`,
	subject: `${BADGE} border-border`,
};

export function defaultEnabledFor(role: StaffRole): Record<string, boolean> {
	const matrix: Record<StaffRole, Record<string, boolean>> = {
		directeur: Object.fromEntries(STAFF_PERMISSIONS.map(p => [p.key, true])),
		prof_principal: Object.fromEntries(
			STAFF_PERMISSIONS.map(p => [p.key, !['staff.manage', 'finance.manage', 'config.school'].includes(p.key)]),
		),
		professeur: Object.fromEntries(
			STAFF_PERMISSIONS.map(p => [
				p.key,
				['grades.edit', 'grades.view', 'records.edit', 'life.absences', 'life.tardiness', 'life.discipline'].includes(p.key),
			]),
		),
		educateur: Object.fromEntries(
			STAFF_PERMISSIONS.map(p => [
				p.key,
				['grades.view', 'life.absences', 'life.tardiness', 'life.discipline'].includes(p.key),
			]),
		),
	};
	return matrix[role];
}

export type RoleAccess = 'full' | 'read' | 'scoped' | 'none';
export type Scope = 'global' | 'class' | 'subject';

export const ROLE_PERMISSIONS: Array<{
	key: string;
	category: string;
	label: string;
	description: string;
	access: Record<StaffRole, RoleAccess>;
	scopedNote?: Partial<Record<StaffRole, string>>;
	scopes: Scope[];
}> = [
	{
		key: 'grades.edit',
		category: 'Pédagogie',
		label: 'Saisir / modifier les notes',
		description: 'Création et édition des évaluations et notes académiques.',
		access: { directeur: 'full', prof_principal: 'scoped', professeur: 'scoped', educateur: 'none' },
		scopedNote: { prof_principal: 'Classe attitrée + matières', professeur: 'Classes & matières assignées' },
		scopes: ['class', 'subject'],
	},
	{
		key: 'grades.view',
		category: 'Pédagogie',
		label: 'Consulter les notes & moyennes',
		description: 'Lecture des notes et moyennes pour suivi pédagogique.',
		access: { directeur: 'full', prof_principal: 'full', professeur: 'full', educateur: 'read' },
		scopes: ['global', 'class', 'subject'],
	},
	{
		key: 'reports.edit',
		category: 'Pédagogie',
		label: 'Bulletins & orientation',
		description: 'Édition des bulletins et décisions d\'orientation.',
		access: { directeur: 'full', prof_principal: 'scoped', professeur: 'none', educateur: 'none' },
		scopedNote: { prof_principal: 'Classe attitrée uniquement' },
		scopes: ['global', 'class'],
	},
	{
		key: 'records.edit',
		category: 'Dossiers',
		label: 'Dossiers élèves',
		description: 'Lecture / écriture des dossiers administratifs et pédagogiques.',
		access: { directeur: 'full', prof_principal: 'scoped', professeur: 'read', educateur: 'read' },
		scopedNote: { prof_principal: 'Classe attitrée' },
		scopes: ['global', 'class'],
	},
	{
		key: 'life.absences',
		category: 'Vie scolaire',
		label: 'Absences',
		description: 'Saisie et suivi des absences.',
		access: { directeur: 'full', prof_principal: 'full', professeur: 'scoped', educateur: 'full' },
		scopedNote: { professeur: 'Pour ses cours' },
		scopes: ['global', 'class'],
	},
	{
		key: 'life.tardiness',
		category: 'Vie scolaire',
		label: 'Retards',
		description: 'Enregistrement des retards.',
		access: { directeur: 'full', prof_principal: 'full', professeur: 'scoped', educateur: 'full' },
		scopedNote: { professeur: 'Pour ses cours' },
		scopes: ['global', 'class'],
	},
	{
		key: 'life.discipline',
		category: 'Vie scolaire',
		label: 'Discipline & incidents',
		description: 'Création et suivi des incidents disciplinaires.',
		access: { directeur: 'full', prof_principal: 'full', professeur: 'read', educateur: 'full' },
		scopes: ['global', 'class'],
	},
	{
		key: 'staff.manage',
		category: 'Administration',
		label: 'Gestion du personnel',
		description: 'Ajout, retrait et affectation du personnel.',
		access: { directeur: 'full', prof_principal: 'none', professeur: 'none', educateur: 'none' },
		scopes: ['global'],
	},
	{
		key: 'finance.manage',
		category: 'Administration',
		label: 'Finance & facturation',
		description: 'Frais, facturation et paiements.',
		access: { directeur: 'full', prof_principal: 'none', professeur: 'none', educateur: 'none' },
		scopes: ['global'],
	},
	{
		key: 'config.school',
		category: 'Administration',
		label: 'Configuration de l\'école',
		description: 'Matières, ressources, calendrier et paramètres.',
		access: { directeur: 'full', prof_principal: 'none', professeur: 'none', educateur: 'none' },
		scopes: ['global'],
	},
];

export const SCOPE_LABEL: Record<Scope, string> = { global: 'Globale', class: 'Classe', subject: 'Matière' };

export const SCOPE_TONE: Record<Scope, string> = {
	global: `${BADGE_INFO} border-primary/20`,
	class: `${BADGE} border-border`,
	subject: `${BADGE} border-border`,
};

export const ROLE_TINT: Record<StaffRole, string> = {
	directeur: 'bg-primary/10 text-primary',
	prof_principal: 'bg-primary/10 text-primary',
	professeur: 'bg-secondary text-foreground/80',
	educateur: 'bg-secondary text-foreground/80',
};

export type Crud = 'C' | 'R' | 'U' | 'D';

export const CRUD_KEYS: Crud[] = ['C', 'R', 'U', 'D'];

export const CRUD_LABEL: Record<Crud, string> = {
	C: 'Créer',
	R: 'Lire',
	U: 'Modifier',
	D: 'Supprimer',
};

export const CRUD_TONE: Record<Crud, string> = {
	C: 'data-[on=true]:bg-primary/10 data-[on=true]:text-primary data-[on=true]:border-primary/20',
	R: 'data-[on=true]:bg-secondary data-[on=true]:text-foreground/80 data-[on=true]:border-border',
	U: 'data-[on=true]:bg-highlight-soft data-[on=true]:text-highlight data-[on=true]:border-highlight/20',
	D: 'data-[on=true]:bg-destructive/10 data-[on=true]:text-destructive data-[on=true]:border-destructive/20',
};

export function defaultCrud(access: RoleAccess): Record<Crud, boolean> {
	switch (access) {
		case 'full':
			return { C: true, R: true, U: true, D: true };
		case 'scoped':
			return { C: true, R: true, U: true, D: false };
		case 'read':
			return { C: false, R: true, U: false, D: false };
		case 'none':
			return { C: false, R: false, U: false, D: false };
	}
}

export function fmtActivityDate(d: string) {
	return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateFr(d: string) {
	return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
