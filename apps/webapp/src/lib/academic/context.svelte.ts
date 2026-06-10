import { browser } from '$app/environment';
import { authSession } from '$lib/auth/session.svelte';
import {
	academicPeriods as seedPeriods,
	academicYears as seedYears,
	buildClassHierarchy,
	classes as seedClasses,
	gradeLevelById,
	gradeLevels,
	periodDefinitions,
	schools,
	type AcademicPeriod,
	type AcademicYear,
	type ClassNode,
	type HierarchyGroup
} from '$lib/data/school';

const STORAGE_YEAR = 'edaya:yearId';
const STORAGE_PERIOD = 'edaya:periodId';

const GRADE_CLASS_PREFIX: Record<string, string> = {
	'gl-6': '6',
	'gl-5': '5',
	'gl-4': '4',
	'gl-3': '3',
	'gl-2': '2',
	'gl-1': '1st',
	'gl-t': 'term'
};

function clone<T>(value: T): T {
	return structuredClone(value);
}

function schoolId(): string {
	return authSession.schoolId ?? schools[0]?.id ?? 'sch-edaya-central';
}

class AcademicContext {
	years = $state<AcademicYear[]>(clone(seedYears));
	periods = $state<AcademicPeriod[]>(clone(seedPeriods));
	classes = $state<ClassNode[]>(clone(seedClasses));
	yearId = $state('2025');
	periodId = $state('2025-t3');

	constructor() {
		if (browser) this.hydrateSelection();
	}

	private hydrateSelection() {
		const storedYear = sessionStorage.getItem(STORAGE_YEAR);
		const storedPeriod = sessionStorage.getItem(STORAGE_PERIOD);
		if (storedYear && this.years.some((y) => y.id === storedYear)) {
			this.yearId = storedYear;
		}
		if (storedPeriod && this.periods.some((p) => p.id === storedPeriod)) {
			this.periodId = storedPeriod;
		}
		this.syncPeriodToYear();
	}

	private persistSelection() {
		if (!browser) return;
		sessionStorage.setItem(STORAGE_YEAR, this.yearId);
		sessionStorage.setItem(STORAGE_PERIOD, this.periodId);
	}

	hierarchy = $derived(buildClassHierarchy(this.classes, gradeLevels));

	publishedYears = $derived(this.years.filter((y) => y.status === 'published'));

	publishedPeriods = $derived(this.periods.filter((p) => p.status === 'published'));

	year = $derived(this.years.find((y) => y.id === this.yearId) ?? this.years[0]);

	period = $derived(this.periods.find((p) => p.id === this.periodId) ?? this.periods[0]);

	periodsForYear = $derived(this.periods.filter((p) => p.academicYearId === this.yearId));

	publishedPeriodsForYear = $derived(
		this.publishedPeriods.filter((p) => p.academicYearId === this.yearId)
	);

	setYear(id: string) {
		this.yearId = id;
		this.syncPeriodToYear();
		this.persistSelection();
	}

	setPeriod(id: string) {
		this.periodId = id;
		this.persistSelection();
	}

	private syncPeriodToYear() {
		const options = this.publishedPeriodsForYear;
		if (options.length === 0) return;
		if (!options.some((p) => p.id === this.periodId)) {
			this.periodId = options[options.length - 1]!.id;
		}
	}

	createYear(label: string, startDate: string, endDate: string) {
		const numericIds = this.years.map((y) => parseInt(y.id, 10)).filter((n) => !Number.isNaN(n));
		const nextNumeric = (numericIds.length ? Math.max(...numericIds) : 2025) + 1;
		const id = String(nextNumeric);
		const sid = schoolId();

		const year: AcademicYear = {
			id,
			schoolId: sid,
			label: label.trim() || `${nextNumeric - 1} — ${nextNumeric}`,
			startDate,
			endDate,
			status: 'draft'
		};

		const newPeriods: AcademicPeriod[] = periodDefinitions.map((def) => ({
			id: `${id}-t${def.order}`,
			schoolId: sid,
			academicYearId: id,
			periodDefinitionId: def.id,
			label: `Trimestre ${def.order}`,
			range: def.order === 1 ? 'Sep — Dec' : def.order === 2 ? 'Jan — Apr' : 'May — Jul',
			startDate,
			endDate,
			status: 'draft' as const
		}));

		this.years = [...this.years, year];
		this.periods = [...this.periods, ...newPeriods];
		return year;
	}

	publishYear(yearId: string) {
		this.years = this.years.map((y) =>
			y.id === yearId ? { ...y, status: 'published' as const } : y
		);
		return this.years.find((y) => y.id === yearId);
	}

	publishPeriod(periodId: string) {
		this.periods = this.periods.map((p) =>
			p.id === periodId ? { ...p, status: 'published' as const } : p
		);
		return this.periods.find((p) => p.id === periodId);
	}

	addClass(name: string, gradeLevelId: string) {
		const gradeLevel = gradeLevelById(gradeLevelId);
		if (!gradeLevel) return null;

		const id = this.nextClassId(gradeLevelId);
		const entry: ClassNode = {
			id,
			schoolId: schoolId(),
			academicYearId: this.yearId,
			gradeLevelId,
			name: name.trim(),
			level: gradeLevel.cycle,
			studentCount: 0
		};

		this.classes = [...this.classes, entry];
		return entry;
	}

	updateClass(
		id: string,
		patch: Partial<Pick<ClassNode, 'name' | 'gradeLevelId' | 'studentCount'>>
	) {
		const gradeLevel = patch.gradeLevelId ? gradeLevelById(patch.gradeLevelId) : undefined;
		this.classes = this.classes.map((c) => {
			if (c.id !== id) return c;
			return {
				...c,
				...patch,
				level: gradeLevel?.cycle ?? c.level
			};
		});
	}

	removeClass(id: string) {
		const removed = this.classes.find((c) => c.id === id);
		this.classes = this.classes.filter((c) => c.id !== id);
		return removed ?? null;
	}

	init(years: AcademicYear[], periods: AcademicPeriod[], classes: ClassNode[]) {
		this.years = years;
		this.periods = periods;
		this.classes = classes;

		if (years.length > 0 && !years.some((y) => y.id === this.yearId)) {
			const activeYear = years.find((y) => y.status === 'published') ?? years[0];
			if (activeYear) this.yearId = activeYear.id;
		}

		this.syncPeriodToYear();
	}

	private nextClassId(gradeLevelId: string): string {
		const prefix = GRADE_CLASS_PREFIX[gradeLevelId] ?? 'cls';
		const siblings = this.classes.filter((c) => c.gradeLevelId === gradeLevelId);
		let index = siblings.length;
		let id = index === 0 && prefix === '2' ? '2nd' : `${prefix}${String.fromCharCode(97 + index)}`;
		while (this.classes.some((c) => c.id === id)) {
			index += 1;
			id = `${prefix}${String.fromCharCode(97 + index)}`;
		}
		return id;
	}
}

export const academicContext = new AcademicContext();

/** Classes visibles côté load() — seed en SSR, contexte en client. */
export function getRuntimeClasses(): ClassNode[] {
	return browser ? academicContext.classes : seedClasses;
}

export function getRuntimeHierarchy(): HierarchyGroup[] {
	return browser ? academicContext.hierarchy : buildClassHierarchy(seedClasses, gradeLevels);
}

export function getRuntimeYears(): AcademicYear[] {
	return browser ? academicContext.years : seedYears;
}

export function getRuntimePeriods(): AcademicPeriod[] {
	return browser ? academicContext.periods : seedPeriods;
}
