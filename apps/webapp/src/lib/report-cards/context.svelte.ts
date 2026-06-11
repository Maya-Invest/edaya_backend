import type { GradeScale, ReportCardDefinition, ReportCardResult } from '$lib/types/report-cards';
import { academicContext } from '$lib/academic/context.svelte';

function clone<T>(value: T): T {
	return structuredClone(value);
}

class ReportCardsContext {
	scales = $state<GradeScale[]>([]);
	definitions = $state<ReportCardDefinition[]>([]);
	results = $state<ReportCardResult[]>([]);
	ready = $state(false);

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
