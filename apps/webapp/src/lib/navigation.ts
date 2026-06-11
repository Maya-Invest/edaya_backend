import type { ResolvedPathname } from '$app/types';
import type { LucideIcon } from '$lib/icons';
import {
	Users,
	Shield,
	CalendarDays,
	Sparkle,
	AlertTriangle,
	GraduationCap,
	BookOpen,
	ClipboardCheck,
	FileSpreadsheet,
	Percent,
	BadgeDollarSign,
	Receipt,
	Wallet,
	ShieldCheck,
	Building2,
	LayoutGrid,
	Wallet as WalletIcon,
	Settings2,
	CalendarRange,
	Layers,
} from '$lib/icons';
import { appPath } from '$lib/navigation/app-navigation';

export type { LucideIcon };

export type ModuleKey = 'school' | 'classes' | 'finance' | 'configuration';

export const MODULES: {
	key: ModuleKey;
	tKey: string;
	icon: LucideIcon;
	href: ResolvedPathname;
}[] = [
	{ key: 'school', tKey: 'module.school', icon: Building2, href: appPath('/(app)/school/students/[[id]]') },
	{ key: 'classes', tKey: 'module.classes', icon: LayoutGrid, href: appPath('/(app)/classes/[classId]/students/[[id]]', { classId: '6a' }) },
	{ key: 'finance', tKey: 'module.finance', icon: WalletIcon, href: appPath('/(app)/finance/billing/[[id]]') },
	{ key: 'configuration', tKey: 'module.configuration', icon: Settings2, href: appPath('/(app)/configuration/subjects/[[id]]') },
];

export interface ContextItem {
	key: string;
	labelKey: string;
	icon?: LucideIcon;
	badge?: string | number;
	href: ResolvedPathname | string;
}

export const SCHOOL_ITEMS: ContextItem[] = [
	{ key: 'students', labelKey: 'school.students', icon: Users, href: appPath('/(app)/school/students/[[id]]') },
	{ key: 'guardians', labelKey: 'school.guardians', icon: Shield, href: appPath('/(app)/school/guardians/[[id]]') },
	{ key: 'calendar', labelKey: 'school.calendar', icon: CalendarDays, href: appPath('/(app)/school/calendar/[[id]]') },
	{ key: 'activities', labelKey: 'school.activities', icon: Sparkle, href: appPath('/(app)/school/activities/[[id]]') },
	{ key: 'events', labelKey: 'school.events', icon: AlertTriangle, href: appPath('/(app)/school/events/[[id]]') },
];

export const CLASS_ITEMS: ContextItem[] = [
	{ key: 'students', labelKey: 'tab.students', icon: Users, href: 'students' },
	{ key: 'subjects', labelKey: 'tab.subjects', icon: GraduationCap, href: 'subjects' },
	{ key: 'timetable', labelKey: 'tab.timetable', icon: CalendarDays, href: 'timetable' },
	{ key: 'teaching', labelKey: 'tab.teaching', icon: BookOpen, href: 'teaching' },
	{ key: 'evaluations', labelKey: 'tab.evaluations', icon: ClipboardCheck, href: 'evaluations' },
	{ key: 'reportCards', labelKey: 'tab.reportCards', icon: FileSpreadsheet, href: 'report-cards' },
];

export const FINANCE_ITEMS: ContextItem[] = [
	{ key: 'fees', labelKey: 'finance.fees', icon: BadgeDollarSign, href: appPath('/(app)/finance/fees/[[id]]') },
	{ key: 'billing', labelKey: 'finance.billing', icon: Receipt, href: appPath('/(app)/finance/billing/[[id]]') },
	{ key: 'payment', labelKey: 'finance.payment', icon: Wallet, href: appPath('/(app)/finance/payment') },
];

export const CONFIG_ITEMS: ContextItem[] = [
	{ key: 'academic', labelKey: 'config.academic', icon: CalendarRange, href: appPath('/(app)/configuration/academic') },
	{ key: 'classGroups', labelKey: 'config.classGroups', icon: Layers, href: appPath('/(app)/configuration/classes') },
	{ key: 'subjects', labelKey: 'config.subjects', icon: BookOpen, href: appPath('/(app)/configuration/subjects/[[id]]') },
	{ key: 'staff', labelKey: 'config.staff', icon: GraduationCap, href: appPath('/(app)/configuration/staff/[[id]]') },
	{ key: 'roles', labelKey: 'roles.title', icon: ShieldCheck, href: appPath('/(app)/configuration/roles/[[role]]') },
	{ key: 'gradeScales', labelKey: 'config.gradeScales', icon: Percent, href: appPath('/(app)/configuration/grade-scales') },
	{ key: 'reportCards', labelKey: 'config.reportCards', icon: FileSpreadsheet, href: appPath('/(app)/configuration/report-cards/[[id]]') },
];

export function getModuleFromPath(pathname: string): ModuleKey {
	if (pathname.startsWith('/classes'))
		return 'classes';
	if (pathname.startsWith('/finance'))
		return 'finance';
	if (pathname.startsWith('/configuration'))
		return 'configuration';
	return 'school';
}

export { classItemHref } from '$lib/navigation/app-navigation';
