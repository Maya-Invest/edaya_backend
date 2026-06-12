<script lang="ts">
	import type { Subject } from '$lib/types/school';
	import { t } from '$lib/i18n';
	import { Sparkles } from '$lib/icons';
	import { teachingLogContext } from '$lib/teaching-log/context.svelte';
	import SubjectsView from './SubjectsView.svelte';

	const {
		classId,
		subjects,
		onSelectSubject,
		selectedSubjectId,
	}: {
		classId: string;
		subjects: Subject[];
		onSelectSubject?: (s: Subject) => void;
		selectedSubjectId?: string;
	} = $props();

	const classSubjects = $derived(subjects.filter(s => s.classId === classId));
	const entries = $derived(teachingLogContext.resolveClassEntries(classId, classSubjects));
	const allSubjects = $derived(Array.from(new Set(entries.map(e => e.subject))));

	const overallProgress = $derived(
		Math.round(
			allSubjects.reduce((acc, name) => {
				const latest = entries
					.filter(e => e.subject === name)
					.sort((a, b) => (a.date < b.date ? 1 : -1))[0];
				return acc + (latest?.progress ?? 0);
			}, 0) / Math.max(1, allSubjects.length),
		),
	);

	function getProgress(s: Subject) {
		const es = teachingLogContext.resolveSubjectEntries(s.name, s.classId);
		const byCh: Record<string, number> = {};
		for (const e of es) {
			const prev = byCh[e.chapter];
			if (prev === undefined || e.progress > prev)
				byCh[e.chapter] = e.progress;
		}
		const arr = Object.values(byCh);
		return arr.length ? Math.round(arr.reduce((a, p) => a + p, 0) / arr.length) : 0;
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('teaching.eyebrow')}
			</p>
			<h2 class="font-display text-2xl font-semibold">{$t('teaching.title')}</h2>
			<p class="mt-1 max-w-xl text-sm text-muted-foreground">{$t('teaching.subtitle')}</p>
		</div>
		<div
			class="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-soft"
		>
			<Sparkles class="h-4 w-4 text-accent" />
			<div>
				<p class="text-[10px] uppercase tracking-wider text-muted-foreground">
					{$t('teaching.overallProgress')}
				</p>
				<div class="mt-0.5 flex items-center gap-2">
					<div class="h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
						<div class="h-full bg-accent" style:width="{overallProgress}%"></div>
					</div>
					<span class="font-mono text-xs">{overallProgress}%</span>
				</div>
			</div>
		</div>
	</div>

	<div class="mb-6">
		<SubjectsView
			subjects={classSubjects}
			onSelect={s => onSelectSubject?.(s)}
			selectedId={selectedSubjectId}
			{getProgress}
		/>
	</div>
</div>
