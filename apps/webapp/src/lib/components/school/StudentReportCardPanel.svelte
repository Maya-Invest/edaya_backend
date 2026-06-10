<script lang="ts">
	import { FileSpreadsheet } from 'lucide-svelte';
	import type { Student } from '$lib/data/school';
	import { formatGrade, gradeScaleById } from '$lib/data/report-cards';
	import { academicContext } from '$lib/academic/context.svelte';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import DrawerEmptyState from './DrawerEmptyState.svelte';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { cn } from '$lib/utils';
	import { get } from 'svelte/store';

	let { s }: { s: Student } = $props();

	const results = $derived(reportCardsContext.resultsForStudent(s.id));
	const latest = $derived(
		[...results].sort((a, b) => b.academicPeriodId.localeCompare(a.academicPeriodId))[0]
	);
	const scale = $derived(latest ? gradeScaleById(latest.gradeScaleId) : null);
	const period = $derived(
		latest ? academicContext.periods.find((p) => p.id === latest.academicPeriodId) : null
	);

	function generate() {
		const r = reportCardsContext.generateResult(s.id);
		if (r) toast.success(get(t)('reportCards.toastGenerated', { name: s.name }));
	}

	function publish() {
		if (!latest) return;
		reportCardsContext.publishResult(latest.id);
		toast.success(get(t)('reportCards.toastPublished', { name: s.name }));
	}
</script>

<div class="space-y-4">
	{#if !latest}
		<DrawerEmptyState label={$t('reportCards.emptyStudent')}>
			{#snippet icon()}
				<FileSpreadsheet class="h-5 w-5 text-muted-foreground" />
			{/snippet}
		</DrawerEmptyState>
		<p class="text-center text-xs text-muted-foreground">{$t('reportCards.emptyStudentHint')}</p>
		<div class="flex justify-center">
			<Button class="rounded-full" onclick={generate}>
				<FileSpreadsheet class="h-4 w-4" />
				{$t('reportCards.generate')}
			</Button>
		</div>
	{:else}
		<div class="flex flex-wrap items-center gap-2">
			<span class="font-mono text-xs text-muted-foreground">
				{period?.label ?? latest.academicPeriodId}
			</span>
			<span
				class={cn(
					'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase',
					latest.status === 'published'
						? 'bg-accent/15'
						: latest.status === 'generated'
							? 'bg-highlight-soft text-highlight'
							: 'bg-secondary text-muted-foreground'
				)}
			>
				{latest.status === 'published'
					? $t('academic.published')
					: latest.status === 'generated'
						? 'Généré'
						: $t('academic.draft')}
			</span>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-xl border border-border bg-secondary/30 p-4 text-center">
				<p class="font-mono text-[10px] uppercase text-muted-foreground">{$t('reportCards.overall')}</p>
				<p class="font-display text-3xl font-semibold">
					{scale ? formatGrade(latest.overallAverage, scale.id) : latest.overallAverage}
				</p>
			</div>
			<div class="rounded-xl border border-border bg-secondary/30 p-4 text-center">
				<p class="font-mono text-[10px] uppercase text-muted-foreground">{$t('reportCards.rank')}</p>
				<p class="font-display text-3xl font-semibold">{latest.classRank}/{latest.classSize}</p>
			</div>
		</div>

		{#each latest.sectionResults as section (section.sectionId)}
			{#if section.marks.length > 0}
				<div>
					<p class="mb-2 text-sm font-semibold">
						{$t('reportCards.marks')}
						{#if section.sectionAverage !== undefined && scale}
							<span class="ml-1 font-mono text-xs font-normal text-muted-foreground">
								({formatGrade(section.sectionAverage, scale.id)})
							</span>
						{/if}
					</p>
					<ul class="space-y-1.5">
						{#each section.marks as mark (mark.subjectId)}
							<li class="flex justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
								<span>{mark.subjectName}</span>
								<span class="font-mono font-medium">
									{scale ? formatGrade(mark.average, scale.id) : mark.average}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}

		{#if latest.homeroomComment}
			<div class="rounded-xl border border-border p-3">
				<p class="font-mono text-[10px] uppercase text-muted-foreground">
					{$t('reportCards.homeroomComment')}
				</p>
				<p class="mt-1 text-sm">{latest.homeroomComment}</p>
			</div>
		{/if}

		{#if latest.principalComment}
			<div class="rounded-xl border border-border p-3">
				<p class="font-mono text-[10px] uppercase text-muted-foreground">
					{$t('reportCards.principalComment')}
				</p>
				<p class="mt-1 text-sm">{latest.principalComment}</p>
			</div>
		{/if}

		<div class="flex justify-end gap-2">
			{#if latest.status === 'generated'}
				<Button class="rounded-full" onclick={publish}>{$t('reportCards.publish')}</Button>
			{/if}
		</div>
	{/if}
</div>
