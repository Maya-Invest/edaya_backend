import { academicContext } from '$lib/academic/context.svelte';
import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';
import { toast } from '$lib/toast.svelte';
import { get } from 'svelte/store';
import { t } from '$lib/i18n';

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
	}), { successMessage: input.successMessage });
	return result ? id : null;
}

export async function recordAssessmentResultMutation(input: {
	studentId: string;
	assessmentId: string;
	score: number;
	successMessage?: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const id = `ar-${input.assessmentId}-${input.studentId}`;
	const result = await runMutation(() => client.commands.recordAssessmentResult({
		id,
		studentId: input.studentId,
		assessmentId: input.assessmentId,
		score: input.score,
		createdAt: new Date().toISOString(),
	}), { successMessage: input.successMessage });
	return result !== null;
}
