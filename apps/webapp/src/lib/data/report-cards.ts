/**
 * Bulletins & barèmes de notes — mocks alignés futur API
 * (`grade-scales`, `report-card-definitions`, `report-card-results`).
 */

import type { Subject } from './school';
import { schools, subjects } from './school';

const DEMO_SCHOOL_ID = schools[0].id;

// ─── Barèmes ───────────────────────────────────────────────────────────────

export interface GradeScale {
	id: string;
	schoolId: string;
	name: string;
	minScore: number;
	maxScore: number;
	passingScore: number;
	decimalPlaces: number;
	description?: string;
	isDefault?: boolean;
}

export const gradeScales: GradeScale[] = [
	{
		id: 'gs-20',
		schoolId: DEMO_SCHOOL_ID,
		name: 'Sur 20',
		minScore: 0,
		maxScore: 20,
		passingScore: 10,
		decimalPlaces: 2,
		description: 'Barème standard français — note sur 20, seuil de réussite à 10.',
		isDefault: true,
	},
	{
		id: 'gs-100',
		schoolId: DEMO_SCHOOL_ID,
		name: 'Sur 100',
		minScore: 0,
		maxScore: 100,
		passingScore: 50,
		decimalPlaces: 1,
		description: 'Pourcentage ou centième — utilisé en sport ou projets transversaux.',
	},
	{
		id: 'gs-lettres',
		schoolId: DEMO_SCHOOL_ID,
		name: 'Appréciations (A–D)',
		minScore: 0,
		maxScore: 4,
		passingScore: 2,
		decimalPlaces: 0,
		description: 'A = Très bien · B = Bien · C = Assez bien · D = Insuffisant.',
	},
];

// ─── Modèles de bulletin ───────────────────────────────────────────────────

export type ReportCardPublishStatus = 'draft' | 'published';

export type ReportCardSectionKind = 'matieres' | 'synthese' | 'appreciation';

export interface ReportCardSection {
	id: string;
	definitionId: string;
	name: string;
	kind: ReportCardSectionKind;
	order: number;
	coefficient?: number;
	/** Matières incluses ; vide = toutes les matières de la classe. */
	subjectIds?: string[];
}

export interface ReportCardDefinition {
	id: string;
	schoolId: string;
	name: string;
	academicYearId: string;
	gradeLevelId: string;
	gradeScaleId: string;
	status: ReportCardPublishStatus;
	sections: ReportCardSection[];
}

const RCD_MS_6 = 'rcd-ms-6';
const RCD_TERM = 'rcd-term';

export const reportCardDefinitions: ReportCardDefinition[] = [
	{
		id: RCD_MS_6,
		schoolId: DEMO_SCHOOL_ID,
		name: 'Bulletin trimestriel — Collège (6ème)',
		academicYearId: '2025',
		gradeLevelId: 'gl-6',
		gradeScaleId: 'gs-20',
		status: 'published',
		sections: [
			{
				id: 'rcs-ms-fond',
				definitionId: RCD_MS_6,
				name: 'Matières fondamentales',
				kind: 'matieres',
				order: 1,
				coefficient: 2,
				subjectIds: ['sub1', 'sub2', 'sub3'],
			},
			{
				id: 'rcs-ms-sci',
				definitionId: RCD_MS_6,
				name: 'Sciences & langues',
				kind: 'matieres',
				order: 2,
				coefficient: 1.5,
				subjectIds: ['sub4', 'sub5'],
			},
			{
				id: 'rcs-ms-sport',
				definitionId: RCD_MS_6,
				name: 'EPS & arts',
				kind: 'matieres',
				order: 3,
				coefficient: 1,
				subjectIds: ['sub6'],
			},
			{
				id: 'rcs-ms-synth',
				definitionId: RCD_MS_6,
				name: 'Synthèse trimestrielle',
				kind: 'synthese',
				order: 4,
			},
			{
				id: 'rcs-ms-appr',
				definitionId: RCD_MS_6,
				name: 'Appréciations',
				kind: 'appreciation',
				order: 5,
			},
		],
	},
	{
		id: RCD_TERM,
		schoolId: DEMO_SCHOOL_ID,
		name: 'Bulletin semestriel — Terminale',
		academicYearId: '2025',
		gradeLevelId: 'gl-t',
		gradeScaleId: 'gs-20',
		status: 'published',
		sections: [
			{
				id: 'rcs-term-spé',
				definitionId: RCD_TERM,
				name: 'Spécialités',
				kind: 'matieres',
				order: 1,
				coefficient: 3,
				subjectIds: ['sub7', 'sub8'],
			},
			{
				id: 'rcs-term-synth',
				definitionId: RCD_TERM,
				name: 'Moyennes & rang',
				kind: 'synthese',
				order: 2,
			},
			{
				id: 'rcs-term-appr',
				definitionId: RCD_TERM,
				name: 'Appréciations & orientation',
				kind: 'appreciation',
				order: 3,
			},
		],
	},
	{
		id: 'rcd-ms-draft',
		schoolId: DEMO_SCHOOL_ID,
		name: 'Bulletin trimestriel — 5ème (brouillon)',
		academicYearId: '2026',
		gradeLevelId: 'gl-5',
		gradeScaleId: 'gs-20',
		status: 'draft',
		sections: [
			{
				id: 'rcs-5e-all',
				definitionId: 'rcd-ms-draft',
				name: 'Ensemble des matières',
				kind: 'matieres',
				order: 1,
				coefficient: 1,
			},
			{
				id: 'rcs-5e-appr',
				definitionId: 'rcd-ms-draft',
				name: 'Appréciations',
				kind: 'appreciation',
				order: 2,
			},
		],
	},
];

// ─── Résultats bulletin ────────────────────────────────────────────────────

export type ReportCardResultStatus = 'draft' | 'generated' | 'published';

export interface ReportCardSubjectMark {
	subjectId: string;
	subjectName: string;
	average: number;
	coefficient: number;
	appreciation?: string;
	teacherName?: string;
}

export interface ReportCardSectionResult {
	sectionId: string;
	sectionAverage?: number;
	marks: ReportCardSubjectMark[];
}

export interface ReportCardResult {
	id: string;
	schoolId: string;
	studentId: string;
	classId: string;
	definitionId: string;
	academicYearId: string;
	academicPeriodId: string;
	gradeScaleId: string;
	status: ReportCardResultStatus;
	overallAverage: number;
	classRank: number;
	classSize: number;
	sectionResults: ReportCardSectionResult[];
	/** Commentaire professeur principal / classe. */
	homeroomComment?: string;
	/** Commentaire chef d'établissement / direction. */
	principalComment?: string;
	generatedAt?: string;
	publishedAt?: string;
}

function subjectMark(
	subject: Subject,
	average: number,
	coefficient: number,
	appreciation: string,
): ReportCardSubjectMark {
	return {
		subjectId: subject.id,
		subjectName: subject.name,
		average,
		coefficient,
		appreciation,
		teacherName: subject.teacher,
	};
}

function weightedAverage(marks: ReportCardSubjectMark[]): number {
	if (marks.length === 0)
		return 0;
	const totalCoef = marks.reduce((s, m) => s + m.coefficient, 0);
	const sum = marks.reduce((s, m) => s + m.average * m.coefficient, 0);
	return Math.round((sum / totalCoef) * 100) / 100;
}

function build6aSectionResults(
	marksBySection: Record<string, ReportCardSubjectMark[]>,
): ReportCardSectionResult[] {
	return reportCardDefinitions
		.find(d => d.id === RCD_MS_6)!
		.sections
		.filter(s => s.kind === 'matieres')
		.map((section) => {
			const marks = marksBySection[section.id] ?? [];
			return {
				sectionId: section.id,
				sectionAverage: marks.length ? weightedAverage(marks) : undefined,
				marks,
			};
		});
}

const class6aSubjects = subjects.filter(s => s.classId === '6a');

export const reportCardResults: ReportCardResult[] = [
	{
		id: 'rcr-s1-t3',
		schoolId: DEMO_SCHOOL_ID,
		studentId: 's1',
		classId: '6a',
		definitionId: RCD_MS_6,
		academicYearId: '2025',
		academicPeriodId: '2025-t3',
		gradeScaleId: 'gs-20',
		status: 'published',
		overallAverage: 17.2,
		classRank: 1,
		classSize: 6,
		sectionResults: build6aSectionResults({
			'rcs-ms-fond': [
				subjectMark(class6aSubjects[0], 18.5, 2, 'Excellent — maîtrise remarquable de l\'algèbre.'),
				subjectMark(class6aSubjects[1], 16.0, 2, 'Expression claire, analyses pertinentes.'),
				subjectMark(class6aSubjects[2], 17.0, 2, 'Bon esprit de synthèse en géographie.'),
			],
			'rcs-ms-sci': [
				subjectMark(class6aSubjects[3], 17.5, 1.5, 'Curiosité scientifique et rigueur en TP.'),
				subjectMark(class6aSubjects[4], 16.5, 1.5, 'Participation active, oral fluide.'),
			],
			'rcs-ms-sport': [
				subjectMark(class6aSubjects[5], 18.0, 1, 'Esprit d\'équipe et investissement exemplaire.'),
			],
		}),
		homeroomComment:
      'Amélie fait partie des élèves les plus investies de la classe. Résultats constants et comportement exemplaire.',
		principalComment: 'Félicitations du conseil de classe. Tableau d\'honneur.',
		generatedAt: '2026-06-20',
		publishedAt: '2026-06-26',
	},
	{
		id: 'rcr-s2-t3',
		schoolId: DEMO_SCHOOL_ID,
		studentId: 's2',
		classId: '6a',
		definitionId: RCD_MS_6,
		academicYearId: '2025',
		academicPeriodId: '2025-t3',
		gradeScaleId: 'gs-20',
		status: 'published',
		overallAverage: 14.5,
		classRank: 4,
		classSize: 6,
		sectionResults: build6aSectionResults({
			'rcs-ms-fond': [
				subjectMark(class6aSubjects[0], 14.0, 2, 'Progrès en algèbre, rester vigilant sur la rigueur.'),
				subjectMark(class6aSubjects[1], 13.5, 2, 'Devoirs parfois incomplets.'),
				subjectMark(class6aSubjects[2], 15.0, 2, 'Participation correcte.'),
			],
			'rcs-ms-sci': [
				subjectMark(class6aSubjects[3], 14.5, 1.5, 'Résultats hétérogènes en sciences.'),
				subjectMark(class6aSubjects[4], 15.5, 1.5, 'Bon niveau à l\'oral.'),
			],
			'rcs-ms-sport': [subjectMark(class6aSubjects[5], 15.0, 1, 'Assiduité satisfaisante.')],
		}),
		homeroomComment: 'Noah doit consolider son organisation personnelle pour le trimestre prochain.',
		principalComment: 'Encouragements — peut progresser avec un effort régulier.',
		generatedAt: '2026-06-20',
		publishedAt: '2026-06-26',
	},
	{
		id: 'rcr-s3-t3',
		schoolId: DEMO_SCHOOL_ID,
		studentId: 's3',
		classId: '6a',
		definitionId: RCD_MS_6,
		academicYearId: '2025',
		academicPeriodId: '2025-t3',
		gradeScaleId: 'gs-20',
		status: 'generated',
		overallAverage: 12.1,
		classRank: 6,
		classSize: 6,
		sectionResults: build6aSectionResults({
			'rcs-ms-fond': [
				subjectMark(class6aSubjects[0], 11.0, 2, 'Difficultés en calcul, soutien recommandé.'),
				subjectMark(class6aSubjects[1], 12.5, 2, 'Peut mieux faire à l\'écrit.'),
				subjectMark(class6aSubjects[2], 13.0, 2, 'Efforts visibles en histoire.'),
			],
			'rcs-ms-sci': [
				subjectMark(class6aSubjects[3], 11.5, 1.5, 'Compréhension fragile des notions clés.'),
				subjectMark(class6aSubjects[4], 12.0, 1.5, 'Timide à l\'oral.'),
			],
			'rcs-ms-sport': [subjectMark(class6aSubjects[5], 14.0, 1, 'Motivée en EPS.')],
		}),
		homeroomComment: 'Mira doit renforcer son travail personnel et la régularité des devoirs.',
		generatedAt: '2026-06-22',
	},
	{
		id: 'rcr-s5-t3',
		schoolId: DEMO_SCHOOL_ID,
		studentId: 's5',
		classId: '6a',
		definitionId: RCD_MS_6,
		academicYearId: '2025',
		academicPeriodId: '2025-t3',
		gradeScaleId: 'gs-20',
		status: 'published',
		overallAverage: 18.4,
		classRank: 2,
		classSize: 6,
		sectionResults: build6aSectionResults({
			'rcs-ms-fond': [
				subjectMark(class6aSubjects[0], 19.0, 2, 'Maîtrise exceptionnelle.'),
				subjectMark(class6aSubjects[1], 18.0, 2, 'Style élégant, analyses fines.'),
				subjectMark(class6aSubjects[2], 18.5, 2, 'Culture générale remarquable.'),
			],
			'rcs-ms-sci': [
				subjectMark(class6aSubjects[3], 18.0, 1.5, 'Excellente méthode expérimentale.'),
				subjectMark(class6aSubjects[4], 17.5, 1.5, 'Expression orale très assurée.'),
			],
			'rcs-ms-sport': [subjectMark(class6aSubjects[5], 19.0, 1, 'Performance sportive au top.')],
		}),
		homeroomComment: 'Yuki est un modèle pour ses camarades. Résultats et attitude irréprochables.',
		principalComment: 'Tableau d\'honneur avec félicitations du conseil de classe.',
		generatedAt: '2026-06-20',
		publishedAt: '2026-06-26',
	},
	{
		id: 'rcr-s9-t3',
		schoolId: DEMO_SCHOOL_ID,
		studentId: 's9',
		classId: 'term-s',
		definitionId: RCD_TERM,
		academicYearId: '2025',
		academicPeriodId: '2025-t3',
		gradeScaleId: 'gs-20',
		status: 'published',
		overallAverage: 16.2,
		classRank: 3,
		classSize: 2,
		sectionResults: [
			{
				sectionId: 'rcs-term-spé',
				sectionAverage: 16.4,
				marks: [
					subjectMark(subjects.find(s => s.id === 'sub7')!, 17.0, 3, 'Solide en analyse.'),
					subjectMark(subjects.find(s => s.id === 'sub8')!, 15.8, 3, 'Bon raisonnement en PC.'),
				],
			},
		],
		homeroomComment: 'Éliot aborde le bac avec sérieux et méthode.',
		principalComment: 'Parcours cohérent vers les études scientifiques.',
		generatedAt: '2026-06-18',
		publishedAt: '2026-06-25',
	},
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function gradeScaleById(id: string): GradeScale | undefined {
	return gradeScales.find(g => g.id === id);
}

export function defaultGradeScale(): GradeScale {
	return gradeScales.find(g => g.isDefault) ?? gradeScales[0];
}

export function reportCardDefinitionById(id: string): ReportCardDefinition | undefined {
	return reportCardDefinitions.find(d => d.id === id);
}

export function reportCardDefinitionsForLevel(gradeLevelId: string): ReportCardDefinition[] {
	return reportCardDefinitions.filter(d => d.gradeLevelId === gradeLevelId);
}

export function reportCardResultsForStudent(studentId: string): ReportCardResult[] {
	return reportCardResults.filter(r => r.studentId === studentId);
}

export function reportCardResultsForClass(
	classId: string,
	academicPeriodId?: string,
): ReportCardResult[] {
	return reportCardResults.filter(
		r => r.classId === classId && (!academicPeriodId || r.academicPeriodId === academicPeriodId),
	);
}

export function reportCardResultById(id: string): ReportCardResult | undefined {
	return reportCardResults.find(r => r.id === id);
}

export function formatGrade(value: number, scaleId: string): string {
	const scale = gradeScaleById(scaleId) ?? defaultGradeScale();
	return value.toFixed(scale.decimalPlaces);
}
