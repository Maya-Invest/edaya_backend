<script lang="ts">
	import { page } from '$app/stores';
	import type { PlanningEvent, ClassNode, Student } from '$lib/types/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import PermissionGate from '$lib/components/ui/PermissionGate.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { readPlanningListFilters, writePlanningListFilters } from '$lib/list/list-url-filters';
	import { t } from '$lib/i18n';
	import { ClipboardCheck, MapPin, Plus, Search } from '$lib/icons';
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

	const initialFilters = $derived(readPlanningListFilters($page.url));

	let q = $state('');
	let filtersReady = $state(false);
	let attendanceSession = $state<PlanningEvent | null>(null);
	let createOpen = $state(false);

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

	<PlanningFormModal {classId} bind:open={createOpen} onCreated={handleCreated} />

	<div class="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
		{#each DAYS as day (day)}
			{@const items = filteredEvents
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
