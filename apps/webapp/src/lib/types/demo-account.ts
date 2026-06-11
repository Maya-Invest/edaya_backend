import type { StaffRole } from '$lib/data/school';

export interface DemoAccount {
	staffId: string;
	email: string;
	name: string;
	role: StaffRole;
	initials: string;
}
