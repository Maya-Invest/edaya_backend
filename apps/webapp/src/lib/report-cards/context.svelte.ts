import type { GradeScale, ReportCardDefinition, ReportCardResult, ReportCardSectionResult, ReportCardSubjectMark } from '$lib/data/report-cards';
import { academicContext } from '$lib/academic/context.svelte';
import { detailDataContext } from '$lib/detail-data/context.svelte';

function clone<T>(value: T): T {
	return structuredClone(value);
}

function schoolId(): string {
	return academicContext.schools[0]?.id ?? 'sch-edaya-central';
}

class ReportCardsContext {
	scales = $state<GradeScale[]>([]);
	definitions = $state<ReportCardDefinition[]>([]);
	results = $state<ReportCardResult[]>([]);
	ready = $state(false);

	addGradeScale(input: {
		name: string;
		minScore: number;
		maxScore: number;
		passingScore: number;
		decimalPlaces: number;
		description?: string;
	}) {
		const scale: GradeScale = {
			id: `gs-${Date.now().toString(36)}`,
			schoolId: schoolId(),
			name: input.name.trim(),
			minScore: input.minScore,
			maxScore: input.maxScore,
			passingScore: input.passingScore,
			decimalPlaces: input.decimalPlaces,
			description: input.description?.trim(),
		};
		this.scales = [...this.scales, scale];
		return scale;
	}

	publishDefinition(definitionId: string) {
		this.definitions = this.definitions.map(d =>
			d.id === definitionId ? { ...d, status: 'published' as const } : d,
		);
		return this.definitions.find(d => d.id === definitionId);
	}

	publishResult(resultId: string) {
		const now = new Date().toISOString().slice(0, 10);
		this.results = this.results.map(r =>
			r.id === resultId
				? { ...r, status: 'published' as const, publishedAt: now }
				: r,
		);
		return this.results.find(r => r.id === resultId);
	}

	generateResult(studentId: string, periodId = academicContext.periodId): ReportCardResult | null {
		const student = detailDataContext.students.find(s => s.id === studentId);
		if (!student)
return null;

		const existing = this.results.find(
			r => r.studentId === studentId && r.academicPeriodId === periodId,
		);
		if (existing)
return existing;

		const cls = academicContext.classes.find(c => c.id === student.classId);
		if (!cls)
return null;

		const definition
			= this.definitions.find(
				d =>
					d.gradeLevelId === cls.gradeLevelId
					&& d.academicYearId === academicContext.yearId
					&& d.status === 'published',
			)
			?? this.definitions.find(
				d => d.gradeLevelId === cls.gradeLevelId && d.status === 'published',
			);
		if (!definition)
return null;

		const classSubjects = detailDataContext.subjects.filter(s => s.classId === student.classId);
		const matiereSections = definition.sections.filter(s => s.kind === 'matieres');
		const sectionResults: ReportCardSectionResult[] = matiereSections.map((section) => {
			const sectionSubjects = section.subjectIds?.length
				? classSubjects.filter(s => section.subjectIds!.includes(s.id))
				: classSubjects;
			const coef = section.coefficient ?? 1;
			const marks: ReportCardSubjectMark[] = sectionSubjects.map((sub, idx) => {
				const jitter = ((student.id.charCodeAt(1) + idx) % 5) - 2;
				const avg = Math.max(0, Math.min(20, student.average + jitter * 0.3));
				return {
					subjectId: sub.id,
					subjectName: sub.name,
					average: Math.round(avg * 10) / 10,
					coefficient: coef,
					appreciation: 'Résultats consolidés sur la période.',
					teacherName: sub.teacher,
				};
			});
			const sectionAverage
				= marks.length > 0
					? Math.round(
							(marks.reduce((s, m) => s + m.average * m.coefficient, 0)
								/ marks.reduce((s, m) => s + m.coefficient, 0))
							* 100,
						) / 100
					: undefined;
			return { sectionId: section.id, sectionAverage, marks };
		});

		const classStudents = detailDataContext.students.filter(s => s.classId === student.classId);
		const result: ReportCardResult = {
			id: `rcr-${studentId}-${periodId}`,
			schoolId: schoolId(),
			studentId,
			classId: student.classId,
			definitionId: definition.id,
			academicYearId: academicContext.yearId,
			academicPeriodId: periodId,
			gradeScaleId: definition.gradeScaleId,
			status: 'generated',
			overallAverage: student.average,
			classRank: 1,
			classSize: classStudents.length,
			sectionResults,
			homeroomComment: 'Bulletin généré automatiquement (mock).',
			generatedAt: new Date().toISOString().slice(0, 10),
		};

		const peers = [...this.results.filter(
			r => r.classId === student.classId && r.academicPeriodId === periodId && r.id !== result.id,
		), result];
		peers.sort((a, b) => b.overallAverage - a.overallAverage);
		result.classRank = peers.findIndex(r => r.id === result.id) + 1;
		result.classSize = classStudents.length;

		this.results = [...this.results.filter(r => r.id !== result.id), result];
		return result;
	}

	generateForClass(classId: string, periodId = academicContext.periodId): number {
		const classStudents = detailDataContext.students.filter(s => s.classId === classId);
		let count = 0;
		for (const s of classStudents) {
			const had = this.results.some(
				r => r.studentId === s.id && r.academicPeriodId === periodId,
			);
			if (!had && this.generateResult(s.id, periodId))
count += 1;
		}
		return count;
	}

	resultsForClass(classId: string, periodId = academicContext.periodId) {
		return this.results.filter(
			r => r.classId === classId && r.academicPeriodId === periodId,
		);
	}

	resultsForStudent(studentId: string) {
		return this.results.filter(r => r.studentId === studentId);
	}

	hydrateFromServer(input: {
		gradeScales: GradeScale[];
		reportCardDefinitions: ReportCardDefinition[];
		reportCardResults: ReportCardResult[];
	}) {
		this.scales = clone(input.gradeScales);
		this.definitions = clone(input.reportCardDefinitions);
		this.results = clone(input.reportCardResults);
		this.ready = true;
	}

	reset() {
		this.scales = [];
		this.definitions = [];
		this.results = [];
		this.ready = false;
	}
}

export const reportCardsContext = new ReportCardsContext();
