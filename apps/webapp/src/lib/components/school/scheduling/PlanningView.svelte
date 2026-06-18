<script lang="ts">
	import type { PlanningEvent, ClassNode, Student } from '$lib/types/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { ClipboardCheck, MapPin, Plus } from '$lib/icons';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { cn } from '$lib/utils';
	import AttendanceFlow from './AttendanceFlow.svelte';
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

	const DAYS: PlanningEvent['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	let attendanceSession = $state<PlanningEvent | null>(null);
	let createOpen = $state(false);

	const attendanceClass = $derived(
		attendanceSession ? classes.find(c => c.id === attendanceSession!.classId) : null,
	);
	const attendanceStudents = $derived(
		attendanceSession ? students.filter(s => s.classId === attendanceSession!.classId) : [],
	);

	function handleCreated(sessionId: string) {
		appGoto(detailHref.classPlanning(classId, sessionId));
	}

	function subjectTone(subject: string) {
		const tones = [
			'bg-secondary border-border',
			'bg-secondary border-border',
			'bg-highlight-soft border-highlight/20',
			'bg-secondary border-border',
		];
		let h = 0;
		for (let i = 0; i < subject.length; i++) h = (h + subject.charCodeAt(i)) % tones.length;
		return tones[h];
	}
</script>

<div class="animate-fade-in">
	<ListPageHeader
		eyebrow={$t('planning.weeklyBoard')}
		title={$t('planning.title')}
	>
		{#snippet primary()}
			<Button size="sm" class="rounded-full" onclick={() => (createOpen = true)}>
				<Plus class="mr-1 h-4 w-4" />
				{$t('planning.newSession')}
			</Button>
		{/snippet}
	</ListPageHeader>

	<PlanningFormModal {classId} bind:open={createOpen} onCreated={handleCreated} />

	<div class="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
		{#each DAYS as day (day)}
			{@const items = events
				.filter(e => e.day === day)
				.sort((a, b) => a.start.localeCompare(b.start))}
			<div class="flex flex-col rounded-2xl border border-border bg-card/50 p-3">
				<div class="mb-3 flex items-center justify-between px-1">
					<p class="font-display text-sm font-semibold">{$t(`day.full.${day}`)}</p>
					<span
						class="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
					>
						{items.length}
					</span>
				</div>
				<div class="space-y-2">
					{#each items as ev (ev.id)}
						{@const active = selectedId === ev.id}
						<div
							class={cn(
								'group relative rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-soft',
								subjectTone(ev.subject),
								active && 'border-primary/40 bg-primary/5',
							)}
						>
							<button
								type="button"
								onclick={() => onSelect?.(ev)}
								class="block w-full p-3 pr-9 text-left"
							>
								<p class="font-mono text-[10px] tracking-wider text-foreground/70">
									{ev.start} — {ev.end}
								</p>
								<p class="mt-1 text-sm font-semibold leading-tight">{ev.title}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">{ev.subject}</p>
								<div class="mt-2 flex items-center gap-1 text-[11px] text-foreground/70">
									<MapPin class="h-3 w-3" />
									{ev.room}
								</div>
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									attendanceSession = ev;
								}}
								title={$t('calendar.takeAttendance')}
								class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 transition hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
							>
								<ClipboardCheck class="h-3.5 w-3.5" />
							</button>
						</div>
					{/each}
					{#if items.length === 0}
						<p
							class="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground"
						>
							{$t('common.free')}
						</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>

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
