import type { components } from '$lib/api/schema';
import type { getBrowserSchoolClient } from '$lib/api/school-client';
import type { ClassSubjectsSources } from '$lib/api/subjects-data';
import type {
	GradeScale,
	ReportCardDefinition,
	ReportCardPublishStatus,
	ReportCardResult,
	ReportCardResultStatus,
	ReportCardSection,
	ReportCardSectionKind,
	ReportCardSectionResult,
	ReportCardSubjectMark,
} from '$lib/types/report-cards';
import { fetchClassSubjectsSources } from '$lib/api/subjects-data';

type GradeScaleRaw = components['schemas']['GradeScale'];
type ReportCardDefinitionRaw = components['schemas']['ReportCardDefinition'];
type ReportCardDefinitionSectionRaw = components['schemas']['ReportCardDefinitionSection'];
type ReportCardResultRaw = components['schemas']['ReportCardResult'];

const DEMO_SCHOOL_ID = 'sch-edaya-central';

type GradeScaleRangeRaw = GradeScaleRaw['ranges'][number];

const DEFINITION_UI_META: Record<string, { gradeScaleId: string; status: ReportCardPublishStatus }> = {
	'rcd-ms-6': { gradeScaleId: 'gs-20', status: 'published' },
	'rcd-term': { gradeScaleId: 'gs-20', status: 'published' },
	'rcd-ms-draft': { gradeScaleId: 'gs-20', status: 'draft' },
};

const SECTION_UI_META: Record<string, { kind: ReportCardSectionKind; coefficient?: number }> = {
	'rcs-ms-fond': { kind: 'matieres', coefficient: 2 },
	'rcs-ms-sci': { kind: 'matieres', coefficient: 1.5 },
	'rcs-ms-sport': { kind: 'matieres', coefficient: 1 },
	'rcs-ms-synth': { kind: 'synthese' },
	'rcs-ms-appr': { kind: 'appreciation' },
	'rcs-term-spé': { kind: 'matieres', coefficient: 3 },
	'rcs-term-synth': { kind: 'synthese' },
	'rcs-term-appr': { kind: 'appreciation' },
	'rcs-draft-fond': { kind: 'matieres', coefficient: 2 },
	'rcs-draft-appr': { kind: 'appreciation' },
};

const SUBJECT_TO_CLASS_SUBJECT_6A: Record<string, string> = {
	'subj-math': 'cs-6a-math',
	'subj-fr': 'cs-6a-fr',
	'subj-hist': 'cs-6a-hist',
	'subj-sci': 'cs-6a-sci',
	'subj-en': 'cs-6a-en',
	'subj-eps': 'cs-6a-eps',
};

const MARK_UI_META: Record<string, { coefficient: number; appreciation: string }> = {
	'rcr-s1-t3:rcs-ms-fond:cs-6a-math': { coefficient: 2, appreciation: 'Excellent — maîtrise remarquable de l\'algèbre.' },
	'rcr-s1-t3:rcs-ms-fond:cs-6a-fr': { coefficient: 2, appreciation: 'Expression claire, analyses pertinentes.' },
	'rcr-s1-t3:rcs-ms-fond:cs-6a-hist': { coefficient: 2, appreciation: 'Bon esprit de synthèse en géographie.' },
	'rcr-s1-t3:rcs-ms-sci:cs-6a-sci': { coefficient: 1.5, appreciation: 'Curiosité scientifique et rigueur en TP.' },
	'rcr-s1-t3:rcs-ms-sci:cs-6a-en': { coefficient: 1.5, appreciation: 'Participation active, oral fluide.' },
	'rcr-s1-t3:rcs-ms-sport:cs-6a-eps': { coefficient: 1, appreciation: 'Esprit d\'équipe et investissement exemplaire.' },
	'rcr-s2-t3:rcs-ms-fond:cs-6a-math': { coefficient: 2, appreciation: 'Progrès en algèbre, rester vigilant sur la rigueur.' },
	'rcr-s2-t3:rcs-ms-fond:cs-6a-fr': { coefficient: 2, appreciation: 'Devoirs parfois incomplets.' },
	'rcr-s2-t3:rcs-ms-fond:cs-6a-hist': { coefficient: 2, appreciation: 'Participation correcte.' },
	'rcr-s2-t3:rcs-ms-sci:cs-6a-sci': { coefficient: 1.5, appreciation: 'Résultats hétérogènes en sciences.' },
	'rcr-s2-t3:rcs-ms-sci:cs-6a-en': { coefficient: 1.5, appreciation: 'Bon niveau à l\'oral.' },
	'rcr-s2-t3:rcs-ms-sport:cs-6a-eps': { coefficient: 1, appreciation: 'Assiduité satisfaisante.' },
	'rcr-s3-t3:rcs-ms-fond:cs-6a-math': { coefficient: 2, appreciation: 'Difficultés en calcul, soutien recommandé.' },
	'rcr-s3-t3:rcs-ms-fond:cs-6a-fr': { coefficient: 2, appreciation: 'Peut mieux faire à l\'écrit.' },
	'rcr-s3-t3:rcs-ms-fond:cs-6a-hist': { coefficient: 2, appreciation: 'Efforts visibles en histoire.' },
	'rcr-s3-t3:rcs-ms-sci:cs-6a-sci': { coefficient: 1.5, appreciation: 'Compréhension fragile des notions clés.' },
	'rcr-s3-t3:rcs-ms-sci:cs-6a-en': { coefficient: 1.5, appreciation: 'Timide à l\'oral.' },
	'rcr-s3-t3:rcs-ms-sport:cs-6a-eps': { coefficient: 1, appreciation: 'Motivée en EPS.' },
	'rcr-s5-t3:rcs-ms-fond:cs-6a-math': { coefficient: 2, appreciation: 'Maîtrise exceptionnelle.' },
	'rcr-s5-t3:rcs-ms-fond:cs-6a-fr': { coefficient: 2, appreciation: 'Style élégant, analyses fines.' },
	'rcr-s5-t3:rcs-ms-fond:cs-6a-hist': { coefficient: 2, appreciation: 'Culture générale remarquable.' },
	'rcr-s5-t3:rcs-ms-sci:cs-6a-sci': { coefficient: 1.5, appreciation: 'Excellente méthode expérimentale.' },
	'rcr-s5-t3:rcs-ms-sci:cs-6a-en': { coefficient: 1.5, appreciation: 'Expression orale très assurée.' },
	'rcr-s5-t3:rcs-ms-sport:cs-6a-eps': { coefficient: 1, appreciation: 'Performance sportive au top.' },
};

function formatDate(value: unknown): string | undefined {
	if (!value) {
		return undefined;
	}
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'string') {
		return value.slice(0, 10);
	}
	return String(value).slice(0, 10);
}

function teacherNameForClassSubject(
	classSubjectId: string,
	sources: ClassSubjectsSources,
): string | undefined {
	const assignment = sources.staffAssignmentsRaw.find(entry => entry.classSubjectId === classSubjectId);
	if (!assignment) {
		return undefined;
	}
	const teacher = sources.staffMembersRaw.find(member => member.id === assignment.staffId);
	if (!teacher) {
		return undefined;
	}
	return `${teacher.firstName} ${teacher.lastName}`;
}

export function derivePassingScore(ranges: GradeScaleRangeRaw[]): number {
	const passingRanges = ranges.filter(range => range.isPassing);
	if (passingRanges.length === 0) {
		return 0;
	}
	return Math.min(...passingRanges.map(range => range.minScore));
}

function buildDescriptionFromRanges(ranges: GradeScaleRangeRaw[]): string | undefined {
	if (ranges.length === 0 || !ranges.every(range => range.interpretation)) {
		return undefined;
	}
	return [...ranges]
		.reverse()
		.map(range => `${range.letter} = ${range.interpretation}`)
		.join(' · ');
}

export function mapGradeScales(scalesRaw: GradeScaleRaw[]): GradeScale[] {
	return scalesRaw.map(scale => ({
		id: scale.id,
		schoolId: scale.schoolId,
		name: scale.name,
		minScore: scale.minScore,
		maxScore: scale.maxScore,
		isDefault: scale.isDefault,
		passingScore: derivePassingScore(scale.ranges),
		decimalPlaces: scale.decimalPlaces ?? 1,
		description: scale.description ?? buildDescriptionFromRanges(scale.ranges),
	}));
}

function mapDefinitionSections(
	definitionId: string,
	sectionsRaw: ReportCardDefinitionSectionRaw[],
): ReportCardSection[] {
	const definitionSections = sectionsRaw.filter(section => section.reportCardDefinitionId === definitionId);
	const topLevelSections = definitionSections.filter(section => !section.parentSectionId);

	return topLevelSections
		.sort((left, right) => left.order - right.order)
		.map((section) => {
			const meta = SECTION_UI_META[section.id];
			const childSubjects = definitionSections.filter(
				child => child.parentSectionId === section.id && child.subjectId,
			);

			return {
				id: section.id,
				definitionId,
				name: section.name,
				kind: meta?.kind ?? 'matieres',
				order: section.order,
				coefficient: meta?.coefficient ?? section.weight,
				subjectIds: childSubjects.length > 0
					? childSubjects
							.map(child => SUBJECT_TO_CLASS_SUBJECT_6A[child.subjectId ?? ''] ?? child.subjectId ?? '')
							.filter(Boolean)
					: undefined,
			} satisfies ReportCardSection;
		});
}

export function mapReportCardDefinitions(
	definitionsRaw: ReportCardDefinitionRaw[],
	sectionsRaw: ReportCardDefinitionSectionRaw[],
): ReportCardDefinition[] {
	return definitionsRaw.map((definition) => {
		const meta = DEFINITION_UI_META[definition.id];
		return {
			id: definition.id,
			schoolId: definition.schoolId,
			name: definition.name,
			academicYearId: definition.academicYearId,
			gradeLevelId: definition.gradeLevelId,
			gradeScaleId: meta?.gradeScaleId ?? 'gs-20',
			status: definition.isDefault ? 'published' : (meta?.status ?? 'draft'),
			sections: mapDefinitionSections(definition.id, sectionsRaw),
		};
	});
}

interface ApiSectionResult {
	sectionId?: string;
	sectionKind?: string;
	name?: string;
	average?: number;
	weight?: number;
	classSubjectId?: string | null;
	subResults?: ApiSectionResult[];
}

function mapResultStatus(status: ReportCardResultRaw['status']): ReportCardResultStatus {
	return status === 'published' ? 'published' : 'generated';
}

function mapSubjectMark(
	resultId: string,
	sectionId: string,
	subjectResult: ApiSectionResult,
	sources: ClassSubjectsSources,
): ReportCardSubjectMark | null {
	const classSubjectId = subjectResult.classSubjectId ?? undefined;
	if (!classSubjectId) {
		return null;
	}

	const classSubject = sources.classSubjectsRaw.find(entry => entry.id === classSubjectId);
	const subject = classSubject
		? sources.subjectsRaw.find(entry => entry.id === classSubject.subjectId)
		: undefined;
	const meta = MARK_UI_META[`${resultId}:${sectionId}:${classSubjectId}`];

	return {
		subjectId: classSubjectId,
		subjectName: subject?.name ?? subjectResult.name ?? classSubjectId,
		average: subjectResult.average ?? 0,
		coefficient: meta?.coefficient ?? subjectResult.weight ?? 1,
		appreciation: meta?.appreciation,
		teacherName: teacherNameForClassSubject(classSubjectId, sources),
	};
}

function mapSectionResults(
	resultId: string,
	sectionResultsRaw: ApiSectionResult[],
	sources: ClassSubjectsSources,
): ReportCardSectionResult[] {
	return sectionResultsRaw
		.filter(section => SECTION_UI_META[section.sectionId ?? '']?.kind === 'matieres')
		.map((section) => {
			const marks = (section.subResults ?? [])
				.map(sub => mapSubjectMark(resultId, section.sectionId ?? '', sub, sources))
				.filter((mark): mark is ReportCardSubjectMark => mark !== null);

			return {
				sectionId: section.sectionId ?? '',
				sectionAverage: section.average,
				marks,
			};
		});
}

export function mapReportCardResults(
	resultsRaw: ReportCardResultRaw[],
	definitionsRaw: ReportCardDefinitionRaw[],
	sources: ClassSubjectsSources,
): ReportCardResult[] {
	const definitionById = new Map(definitionsRaw.map(definition => [definition.id, definition]));

	return resultsRaw.map((result) => {
		const definition = definitionById.get(result.reportCardDefinitionId);
		const meta = DEFINITION_UI_META[result.reportCardDefinitionId];

		return {
			id: result.id,
			schoolId: definition?.schoolId ?? DEMO_SCHOOL_ID,
			studentId: result.studentId,
			classId: result.classGroupId,
			definitionId: result.reportCardDefinitionId,
			academicYearId: definition?.academicYearId ?? '2025',
			academicPeriodId: result.periodId,
			gradeScaleId: meta?.gradeScaleId ?? 'gs-20',
			status: mapResultStatus(result.status),
			overallAverage: result.overallAverage ?? 0,
			classRank: result.rank ?? 0,
			classSize: result.classSize ?? 0,
			sectionResults: mapSectionResults(
				result.id,
				(result.sectionResults ?? []) as ApiSectionResult[],
				sources,
			),
			homeroomComment: result.teacherComment ?? undefined,
			principalComment: result.principalComment ?? undefined,
			generatedAt: formatDate(result.generatedAt),
			publishedAt: formatDate(result.publishedAt),
		};
	});
}

type SchoolClient = ReturnType<typeof getBrowserSchoolClient>;

export async function loadReportCardsData(client: SchoolClient): Promise<{
	gradeScales: GradeScale[];
	definitions: ReportCardDefinition[];
	results: ReportCardResult[];
}> {
	const [gradeScalesRaw, definitionsRaw, sectionsRaw, resultsRaw, subjectsSources] = await Promise.all([
		client.entities.gradeScales.list({}),
		client.entities.definitions.list({}),
		client.entities.sections.list({}),
		client.entities.results.list({}),
		fetchClassSubjectsSources(client),
	]);

	return {
		gradeScales: mapGradeScales(gradeScalesRaw ?? []),
		definitions: mapReportCardDefinitions(definitionsRaw ?? [], sectionsRaw ?? []),
		results: mapReportCardResults(resultsRaw ?? [], definitionsRaw ?? [], subjectsSources),
	};
}
