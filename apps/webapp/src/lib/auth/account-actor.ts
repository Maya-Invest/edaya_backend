export type SessionKind = 'staff' | 'guardian' | 'student';

export interface AccountActor {
	id: string;
	kind: SessionKind;
	name: string;
	initials: string;
	subtitleKey: string;
	subjectId: string | null;
	email?: string;
}
