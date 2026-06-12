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

const SUBJECT_TO_CLASS_SUBJECT_6A: Record<string, string> = {
	'subj-math': 'cs-6a-math',
	'subj-fr': 'cs-6a-fr',
	'subj-hist': 'cs-6a-hist',
	'subj-sci': 'cs-6a-sci',
	'subj-en': 'cs-6a-en',
	'subj-eps': 'cs-6a-eps',
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

const SECTION_ROLE_VALUES = new Set<ReportCardSectionKind>(['matieres', 'synthese', 'appreciation']);

export function mapSectionRole(
	section: Pick<ReportCardDefinitionSectionRaw, 'role' | 'name'>,
	hasSubjectChildren: boolean,
): ReportCardSectionKind {
	if (section.role && SECTION_ROLE_VALUES.has(section.role as ReportCardSectionKind)) {
		return section.role as ReportCardSectionKind;
	}
	if (hasSubjectChildren) {
		return 'matieres';
	}
	const normalizedName = section.name.toLowerCase();
	if (normalizedName.includes('appréciation')) {
		return 'appreciation';
	}
	if (normalizedName.includes('synthèse') || normalizedName.includes('moyennes')) {
		return 'synthese';
	}
	return 'matieres';
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
			const childSubjects = definitionSections.filter(
				child => child.parentSectionId === section.id && child.subjectId,
			);
			const kind = mapSectionRole(section, childSubjects.length > 0);

			return {
				id: section.id,
				definitionId,
				name: section.name,
				kind,
				order: section.order,
				coefficient: section.coefficient ?? (kind === 'matieres' ? section.weight : undefined),
				subjectIds: childSubjects.length > 0
					? childSubjects
							.map(child => SUBJECT_TO_CLASS_SUBJECT_6A[child.subjectId ?? ''] ?? child.subjectId ?? '')
							.filter(Boolean)
					: undefined,
			} satisfies ReportCardSection;
		});
}

export function mapDefinitionStatus(
	status?: string | null,
): ReportCardPublishStatus {
	return status === 'published' ? 'published' : 'draft';
}

export function mapReportCardDefinitions(
	definitionsRaw: ReportCardDefinitionRaw[],
	sectionsRaw: ReportCardDefinitionSectionRaw[],
): ReportCardDefinition[] {
	return definitionsRaw.map((definition) => ({
		id: definition.id,
		schoolId: definition.schoolId,
		name: definition.name,
		academicYearId: definition.academicYearId,
		gradeLevelId: definition.gradeLevelId,
		gradeScaleId: definition.gradeScaleId,
		status: mapDefinitionStatus(definition.status),
		sections: mapDefinitionSections(definition.id, sectionsRaw),
	}));
}

interface ApiSectionResult {
	sectionId?: string;
	sectionKind?: string;
	name?: string;
	average?: number;
	weight?: number;
	comment?: string | null;
	classSubjectId?: string | null;
	subResults?: ApiSectionResult[];
}

function mapResultStatus(status: ReportCardResultRaw['status']): ReportCardResultStatus {
	return status === 'published' ? 'published' : 'generated';
}

export function mapSubjectMark(
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

	return {
		subjectId: classSubjectId,
		subjectName: subject?.name ?? subjectResult.name ?? classSubjectId,
		average: subjectResult.average ?? 0,
		coefficient: subjectResult.weight ?? 1,
		appreciation: subjectResult.comment ?? undefined,
		teacherName: teacherNameForClassSubject(classSubjectId, sources),
	};
}

function mapSectionResults(
	sectionResultsRaw: ApiSectionResult[],
	sources: ClassSubjectsSources,
): ReportCardSectionResult[] {
	return sectionResultsRaw
		.filter(section => (section.subResults ?? []).some(sub => sub.classSubjectId))
		.map((section) => {
			const marks = (section.subResults ?? [])
				.map(sub => mapSubjectMark(sub, sources))
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

		return {
			id: result.id,
			schoolId: definition?.schoolId ?? DEMO_SCHOOL_ID,
			studentId: result.studentId,
			classId: result.classGroupId,
			definitionId: result.reportCardDefinitionId,
			academicYearId: definition?.academicYearId ?? '2025',
			academicPeriodId: result.periodId,
			gradeScaleId: definition?.gradeScaleId ?? 'gs-20',
			status: mapResultStatus(result.status),
			overallAverage: result.overallAverage ?? 0,
			classRank: result.rank ?? 0,
			classSize: result.classSize ?? 0,
			sectionResults: mapSectionResults(
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
