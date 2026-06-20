<script lang="ts">
	import type { PlanningEvent, ClassNode, Student } from '$lib/types/school';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import PermissionGate from '$lib/components/ui/PermissionGate.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { Plus, Search } from '$lib/icons';
	import { readPlanningListFilters, writePlanningListFilters } from '$lib/list/list-url-filters';
	import { canEditTimetable } from '$lib/permissions';
	import { appGoto } from '$lib/navigation/app-navigation';
	import AttendanceFlow from './AttendanceFlow.svelte';
	import ClassTimetableCalendar from './ClassTimetableCalendar.svelte';
	import PlanningFormModal from './PlanningFormModal.svelte';

	const {
		classId,
		events,
		classes,
		students,
		onSelect,
		selectedId,
	}: {
		classId: string;
		events: PlanningEvent[];
		classes: ClassNode[];
		students: Student[];
		onSelect?: (e: PlanningEvent) => void;
		selectedId?: string;
	} = $props();

	const initialFilters = $derived(readPlanningListFilters($page.url));

	let q = $state('');
	let filtersReady = $state(false);
	let attendanceSession = $state<PlanningEvent | null>(null);
	let createOpen = $state(false);

	const editable = $derived(canEditTimetable({ classId }));

	const filteredEvents = $derived(
		events.filter((ev) => {
			const needle = q.trim().toLowerCase();
			if (!needle)
				return true;
			return ev.title.toLowerCase().includes(needle)
				|| ev.subject.toLowerCase().includes(needle)
				|| ev.teacher.toLowerCase().includes(needle)
				|| ev.room.toLowerCase().includes(needle);
		}),
	);

	const attendanceClass = $derived(
		attendanceSession ? classes.find(c => c.id === attendanceSession!.classId) : null,
	);
	const attendanceStudents = $derived(
		attendanceSession ? students.filter(s => s.classId === attendanceSession!.classId) : [],
	);

	function handleCreated(sessionId: string) {
		const path = detailHref.classPlanning(classId, sessionId);
		appGoto(`${path}${$page.url.search}`);
	}

	function syncFiltersToUrl() {
		const href = writePlanningListFilters($page.url, { q });
		appGoto(href, { replaceState: true, keepFocus: true, noScroll: true });
	}

	$effect(() => {
		const next = initialFilters;
		q = next.q;
		filtersReady = true;
	});

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function scheduleFilterSync() {
		if (!filtersReady)
			return;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(syncFiltersToUrl, 250);
	}
</script>

<div class="animate-fade-in">
	<ListPageHeader
		eyebrow={$t('planning.weeklyBoard')}
		title={$t('planning.title')}
	>
		{#snippet search()}
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					bind:value={q}
					oninput={scheduleFilterSync}
					placeholder={$t('common.search')}
					class="h-9 w-56 rounded-full pl-9 text-sm"
				/>
			</div>
		{/snippet}
		{#snippet primary()}
			<PermissionGate
				permission="TIMETABLE_UPDATE"
				mode="disable"
				tooltip={$t('calendar.permissionUpdate')}
			>
				{#snippet children({ disabled, title })}
					<Button
						size="sm"
						class="rounded-full"
						{disabled}
						{title}
						onclick={() => (createOpen = true)}
					>
						<Plus class="mr-1 h-4 w-4" />
						{$t('planning.newSession')}
					</Button>
				{/snippet}
			</PermissionGate>
		{/snippet}
	</ListPageHeader>

	{#if editable}
		<p class="mb-4 text-xs text-muted-foreground">{$t('planning.dragHint')}</p>
	{/if}

	<PlanningFormModal {classId} bind:open={createOpen} onCreated={handleCreated} />

	<ClassTimetableCalendar
		events={filteredEvents}
		{selectedId}
		{editable}
		{onSelect}
		onAttendance={ev => (attendanceSession = ev)}
	/>

	{#if attendanceSession && attendanceClass}
		<AttendanceFlow
			open={true}
			onClose={() => (attendanceSession = null)}
			students={attendanceStudents}
			className="{attendanceClass.name} · {attendanceSession.subject}"
			classLevel="{$t(`day.${attendanceSession.day}`)} {attendanceSession.start}–{attendanceSession.end}"
		/>
	{/if}
</div>
