import { runMutation } from '$lib/api/mutations/run-mutation';
import { getBrowserSchoolClient } from '$lib/api/school-client';

export async function transferStudentMutation(input: {
	enrollmentId: string;
	studentId: string;
	nextClassGroupId: string;
}): Promise<boolean> {
	const client = getBrowserSchoolClient();
	const nextEnrollmentId = `enr-${input.studentId}-${Date.now().toString(36)}`;
	const result = await runMutation(() => client.commands.transferStudent({
		enrollmentId: input.enrollmentId,
		nextEnrollmentId,
		nextClassGroupId: input.nextClassGroupId,
		effectiveAt: new Date().toISOString().slice(0, 10),
	}));
	return result !== null;
}
