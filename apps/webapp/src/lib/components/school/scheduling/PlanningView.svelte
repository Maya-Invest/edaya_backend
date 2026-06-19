<script lang="ts">
	import type { PlanningEvent, ClassNode, Student } from '$lib/types/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';
	import { Plus } from '$lib/icons';
	import { canEditTimetable } from '$lib/permissions';
	import AttendanceFlow from './AttendanceFlow.svelte';
	import ClassTimetableCalendar from './ClassTimetableCalendar.svelte';

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

	let attendanceSession = $state<PlanningEvent | null>(null);

	const editable = $derived(canEditTimetable({ classId }));

	const attendanceClass = $derived(
		attendanceSession ? classes.find(c => c.id === attendanceSession!.classId) : null,
	);
	const attendanceStudents = $derived(
		attendanceSession ? students.filter(s => s.classId === attendanceSession!.classId) : [],
	);
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex items-center justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('planning.weeklyBoard')}
			</p>
			<h2 class="font-display text-2xl font-semibold">{$t('planning.title')}</h2>
			{#if editable}
				<p class="mt-1 text-xs text-muted-foreground">{$t('planning.dragHint')}</p>
			{/if}
		</div>
		<Button size="sm" class="rounded-full">
			<Plus class="mr-1 h-4 w-4" />
			{$t('planning.newSession')}
		</Button>
	</div>

	<ClassTimetableCalendar
		{events}
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
