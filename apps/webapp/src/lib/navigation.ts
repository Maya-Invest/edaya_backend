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
	Layers
} from 'lucide-svelte';

type LucideIcon = typeof Users;

export type ModuleKey = 'school' | 'classes' | 'finance' | 'configuration';

export const MODULES: {
	key: ModuleKey;
	tKey: string;
	icon: LucideIcon;
	href: string;
}[] = [
	{ key: 'school', tKey: 'module.school', icon: Building2, href: '/school/students' },
	{ key: 'classes', tKey: 'module.classes', icon: LayoutGrid, href: '/classes/6a/students' },
	{ key: 'finance', tKey: 'module.finance', icon: WalletIcon, href: '/finance/billing' },
	{ key: 'configuration', tKey: 'module.configuration', icon: Settings2, href: '/configuration/subjects' }
];

export type ContextItem = {
	key: string;
	labelKey: string;
	icon?: LucideIcon;
	badge?: string | number;
	href: string;
};

export const SCHOOL_ITEMS: ContextItem[] = [
	{ key: 'students', labelKey: 'school.students', icon: Users, href: '/school/students' },
	{ key: 'guardians', labelKey: 'school.guardians', icon: Shield, href: '/school/guardians' },
	{ key: 'calendar', labelKey: 'school.calendar', icon: CalendarDays, href: '/school/calendar' },
	{ key: 'activities', labelKey: 'school.activities', icon: Sparkle, href: '/school/activities' },
	{ key: 'events', labelKey: 'school.events', icon: AlertTriangle, href: '/school/events' }
];

export const CLASS_ITEMS: ContextItem[] = [
	{ key: 'students', labelKey: 'tab.students', icon: Users, href: 'students' },
	{ key: 'subjects', labelKey: 'tab.subjects', icon: GraduationCap, href: 'subjects' },
	{ key: 'timetable', labelKey: 'tab.timetable', icon: CalendarDays, href: 'timetable' },
	{ key: 'teaching', labelKey: 'tab.teaching', icon: BookOpen, href: 'teaching' },
	{ key: 'evaluations', labelKey: 'tab.evaluations', icon: ClipboardCheck, href: 'evaluations' },
	{ key: 'reportCards', labelKey: 'tab.reportCards', icon: FileSpreadsheet, href: 'report-cards' }
];

export const FINANCE_ITEMS: ContextItem[] = [
	{ key: 'fees', labelKey: 'finance.fees', icon: BadgeDollarSign, href: '/finance/fees' },
	{ key: 'billing', labelKey: 'finance.billing', icon: Receipt, href: '/finance/billing' },
	{ key: 'payment', labelKey: 'finance.payment', icon: Wallet, href: '/finance/payment' }
];

export const CONFIG_ITEMS: ContextItem[] = [
	{ key: 'academic', labelKey: 'config.academic', icon: CalendarRange, href: '/configuration/academic' },
	{ key: 'classGroups', labelKey: 'config.classGroups', icon: Layers, href: '/configuration/classes' },
	{ key: 'subjects', labelKey: 'config.subjects', icon: BookOpen, href: '/configuration/subjects' },
	{ key: 'staff', labelKey: 'config.staff', icon: GraduationCap, href: '/configuration/staff' },
	{ key: 'roles', labelKey: 'roles.title', icon: ShieldCheck, href: '/configuration/roles' },
	{ key: 'gradeScales', labelKey: 'config.gradeScales', icon: Percent, href: '/configuration/grade-scales' },
	{ key: 'reportCards', labelKey: 'config.reportCards', icon: FileSpreadsheet, href: '/configuration/report-cards' }
];

export function getModuleFromPath(pathname: string): ModuleKey {
	if (pathname.startsWith('/classes')) return 'classes';
	if (pathname.startsWith('/finance')) return 'finance';
	if (pathname.startsWith('/configuration')) return 'configuration';
	return 'school';
}

export function classItemHref(classId: string, segment: string): string {
	return `/classes/${classId}/${segment}`;
}
