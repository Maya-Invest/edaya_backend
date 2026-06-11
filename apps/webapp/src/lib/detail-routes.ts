import type { ResolvedPathname } from '$app/types';
import type { DrawerItem } from '$lib/components/school/drawer-types';
import type { StaffRole, Subject } from '$lib/data/school';
import {
	students,
	guardians,
	staff,
	subjects,
	planning,
	evaluations,
	activities,
	incidents,
	schoolYearEvents,
	billing,
	fees,
	classes,
} from '$lib/data/school';
import { appPath } from '$lib/navigation/app-navigation';
import { getRuntimeReportCardDefinitions, getRuntimeReportCardResults } from '$lib/report-cards/context.svelte';

export interface ParsedDetail {
	item: NonNullable<DrawerItem>;
	listPath: ResolvedPathname;
}

const STAFF_ROLES = new Set<StaffRole>(['directeur', 'prof_principal', 'professeur', 'educateur']);

function yearLabel(className: string): string {
	const map: Record<string, string> = {
		'6th': '6ème',
		'5th': '5ème',
		'4th': '4ème',
		'3rd': '3ème',
		'2nd': '2nde',
		'1st': '1ère',
		'Terminale': 'Terminale',
	};
	for (const key of Object.keys(map)) {
		if (className.startsWith(key))
			return map[key];
	}
	return className;
}

function getSubjectLevelGroup(label: string): { label: string; subtitle: string; items: Subject[] } | null {
	const classById = Object.fromEntries(classes.map(c => [c.id, c]));
	const byYear: Record<string, { subtitle: string; items: Subject[] }> = {};
	for (const s of subjects) {
		const cls = classById[s.classId];
		if (!cls)
			continue;
		const y = yearLabel(cls.name);
		if (!byYear[y])
			byYear[y] = { subtitle: cls.level, items: [] };
		byYear[y].items.push(s);
	}
	if (!byYear[label])
		return null;
	return { label, subtitle: byYear[label].subtitle, items: byYear[label].items };
}

interface Matcher {
	test: (pathname: string) => RegExpMatchArray | null;
	parse: (m: RegExpMatchArray) => ParsedDetail | null;
}

const matchers: Matcher[] = [
	{
		test: p => p.match(/^\/school\/students\/([^/]+)$/) ?? null,
		parse: (m) => {
			const s = students.find(x => x.id === m[1]);
			return s ? { item: { kind: 'student', data: s }, listPath: appPath('/school/students') } : null;
		},
	},
	{
		test: p => p.match(/^\/school\/guardians\/([^/]+)$/) ?? null,
		parse: (m) => {
			const g = guardians.find(x => x.id === m[1]);
			return g ? { item: { kind: 'guardian', data: g }, listPath: appPath('/school/guardians') } : null;
		},
	},
	{
		test: p => p.match(/^\/school\/activities\/([^/]+)$/) ?? null,
		parse: (m) => {
			const a = activities.find(x => x.id === m[1]);
			return a ? { item: { kind: 'activity', data: a }, listPath: appPath('/school/activities') } : null;
		},
	},
	{
		test: p => p.match(/^\/school\/events\/([^/]+)$/) ?? null,
		parse: (m) => {
			const i = incidents.find(x => x.id === m[1]);
			return i ? { item: { kind: 'incident', data: i }, listPath: appPath('/school/events') } : null;
		},
	},
	{
		test: p => p.match(/^\/school\/calendar\/([^/]+)$/) ?? null,
		parse: (m) => {
			const ev = schoolYearEvents.find(x => x.id === m[1]);
			return ev ? { item: { kind: 'schoolYearEvent', data: ev }, listPath: appPath('/school/calendar') } : null;
		},
	},
	{
		test: p => p.match(/^\/classes\/([^/]+)\/students\/([^/]+)$/) ?? null,
		parse: (m) => {
			const s = students.find(x => x.id === m[2]);
			return s ? { item: { kind: 'student', data: s }, listPath: appPath('/classes/[classId]/students/[[id]]', { classId: m[1] }) } : null;
		},
	},
	{
		test: p => p.match(/^\/classes\/([^/]+)\/subjects\/([^/]+)$/) ?? null,
		parse: (m) => {
			const s = subjects.find(x => x.id === m[2]);
			return s ? { item: { kind: 'subject', data: s }, listPath: appPath('/classes/[classId]/subjects/[[id]]', { classId: m[1] }) } : null;
		},
	},
	{
		test: p => p.match(/^\/classes\/([^/]+)\/timetable\/([^/]+)$/) ?? null,
		parse: (m) => {
			const ev = planning.find(x => x.id === m[2]);
			return ev ? { item: { kind: 'planning', data: ev }, listPath: appPath('/classes/[classId]/timetable/[[id]]', { classId: m[1] }) } : null;
		},
	},
	{
		test: p => p.match(/^\/classes\/([^/]+)\/evaluations\/([^/]+)$/) ?? null,
		parse: (m) => {
			const ev = evaluations.find(x => x.id === m[2]);
			return ev ? { item: { kind: 'evaluation', data: ev }, listPath: appPath('/classes/[classId]/evaluations/[[id]]', { classId: m[1] }) } : null;
		},
	},
	{
		test: p => p.match(/^\/classes\/([^/]+)\/teaching\/([^/]+)$/) ?? null,
		parse: (m) => {
			const s = subjects.find(x => x.id === m[2]);
			return s ? { item: { kind: 'subject', data: s }, listPath: appPath('/classes/[classId]/teaching/[[id]]', { classId: m[1] }) } : null;
		},
	},
	{
		test: p => p.match(/^\/configuration\/subjects\/level\/([^/]+)$/) ?? null,
		parse: (m) => {
			const label = decodeURIComponent(m[1]);
			const group = getSubjectLevelGroup(label);
			return group ? { item: { kind: 'level', data: group }, listPath: appPath('/configuration/subjects') } : null;
		},
	},
	{
		test: p => p.match(/^\/configuration\/subjects\/([^/]+)$/) ?? null,
		parse: (m) => {
			const s = subjects.find(x => x.id === m[1]);
			return s ? { item: { kind: 'subject', data: s }, listPath: appPath('/configuration/subjects') } : null;
		},
	},
	{
		test: p => p.match(/^\/configuration\/staff\/([^/]+)$/) ?? null,
		parse: (m) => {
			const id = m[1];
			if (id.startsWith('st')) {
				const s = staff.find(x => x.id === id);
				return s ? { item: { kind: 'staff', data: s }, listPath: appPath('/configuration/staff') } : null;
			}
			const g = guardians.find(x => x.id === id);
			return g ? { item: { kind: 'guardian', data: g }, listPath: appPath('/configuration/staff') } : null;
		},
	},
	{
		test: p => p.match(/^\/configuration\/roles\/([^/]+)$/) ?? null,
		parse: (m) => {
			const role = m[1] as StaffRole;
			if (!STAFF_ROLES.has(role))
				return null;
			return { item: { kind: 'role', data: { role } }, listPath: appPath('/configuration/roles') };
		},
	},
	{
		test: p => p.match(/^\/finance\/billing\/([^/]+)$/) ?? null,
		parse: (m) => {
			const b = billing.find(x => x.id === m[1]);
			return b ? { item: { kind: 'billing', data: b }, listPath: appPath('/finance/billing') } : null;
		},
	},
	{
		test: p => p.match(/^\/finance\/fees\/([^/]+)$/) ?? null,
		parse: (m) => {
			const f = fees.find(x => x.id === m[1]);
			return f ? { item: { kind: 'fee', data: f }, listPath: appPath('/finance/fees') } : null;
		},
	},
	{
		test: p => p.match(/^\/configuration\/report-cards\/([^/]+)$/) ?? null,
		parse: (m) => {
			const d = getRuntimeReportCardDefinitions().find(x => x.id === m[1]);
			return d
				? { item: { kind: 'reportCardDefinition', data: d }, listPath: appPath('/configuration/report-cards') }
				: null;
		},
	},
	{
		test: p => p.match(/^\/classes\/([^/]+)\/report-cards\/([^/]+)$/) ?? null,
		parse: (m) => {
			const r = getRuntimeReportCardResults().find(x => x.id === m[2]);
			return r
				? {
						item: { kind: 'reportCardResult', data: r },
						listPath: appPath('/classes/[classId]/report-cards/[[id]]', { classId: m[1] }),
					}
				: null;
		},
	},
];

export function parseDetailPath(pathname: string): ParsedDetail | null {
	for (const { test, parse } of matchers) {
		const m = test(pathname);
		if (m)
			return parse(m);
	}
	return null;
}

export function getListPathForDetail(pathname: string): ResolvedPathname | null {
	return parseDetailPath(pathname)?.listPath ?? null;
}
