import { academicContext } from '$lib/academic/context.svelte';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { detailDataContext } from '$lib/detail-data/context.svelte';
import { t } from '$lib/i18n';
import { toast } from '$lib/toast.svelte';
import type { Evaluation } from '$lib/types/school';
import { get } from 'svelte/store';

export async function createAssessmentMutation(input: {
	classGroupId: string;
	classSubjectId: string;
	title: string;
	maxScore: number;
	coefficient?: number;
	kind?: 'quiz' | 'homework' | 'project' | 'other';
	dueAt?: string;
	successMessage?: string;
}): Promise<string | null> {
	const client = getBrowserSchoolClient();
	const periodId = academicContext.periodId;
	if (!periodId) {
		toast.error(get(t)('eval.noPeriod'));
		return null;
	}

	const id = `asm-${Date.now().toString(36)}`;
	const subject = detailDataContext.subjects.find(entry => entry.id === input.classSubjectId);
	const optimistic: Evaluation = {
		id,
		classId: input.classGroupId,
		title: input.title.trim(),
		subject: subject?.name ?? '—',
		date: input.dueAt ?? new Date().toISOString().slice(0, 10),
		coefficient: input.coefficient ?? 1,
		averageMark: 0,
		outOf: input.maxScore,
		graded: 0,
		total: detailDataContext.studentsForClass(input.classGroupId).length,
	};

	const result = await runMutation(() => client.commands.createAssessment({
		id,
		classGroupId: input.classGroupId,
		classSubjectId: input.classSubjectId,
		periodId,
		title: input.title.trim(),
		kind: input.kind ?? 'quiz',
		maxScore: input.maxScore,
		coefficient: input.coefficient ?? 1,
		dueAt: input.dueAt ?? new Date().toISOString().slice(0, 10),
		createdAt: new Date().toISOString(),
	}), {
		successMessage: input.successMessage,
		apply: () => {
			detailDataContext.appendEvaluation(optimistic);
		},
		rollback: () => {
			detailDataContext.removeEvaluation(id);
		},
	});
	return result ? id : null;
}

export async function recordAssessmentResultMutation(input: {
	studentId: string;
	assessmentId: string;
	score: number;
	successMessage?: string;
	apply?: () => void;
	rollback?: () => void;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const id = `ar-${input.assessmentId}-${input.studentId}`;
	const result = await runMutation(() => client.commands.recordAssessmentResult({
		id,
		studentId: input.studentId,
		assessmentId: input.assessmentId,
		score: input.score,
		createdAt: new Date().toISOString(),
	}), {
		successMessage: input.successMessage,
		apply: input.apply,
		rollback: input.rollback,
	});
	return result !== null;
}
