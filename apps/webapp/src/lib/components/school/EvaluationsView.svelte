<script lang="ts">
	import { CalendarDays, Plus } from '$lib/icons';
	import type { Evaluation } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import { locale, t } from '$lib/i18n';

	let {
		evaluations,
		onSelect,
		selectedId,
	}: {
		evaluations: Evaluation[];
		onSelect?: (e: Evaluation) => void;
		selectedId?: string;
	} = $props();
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('eval.marksBook')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('eval.count', { n: evaluations.length })}
			</h2>
		</div>
		<Button size="sm" class="rounded-full">
			<Plus class="mr-1 h-4 w-4" />
			{$t('eval.newEvaluation')}
		</Button>
	</div>

	<div class="space-y-3">
		{#each evaluations as ev (ev.id)}
			{@const active = selectedId === ev.id}
			{@const progress = ev.total ? (ev.graded / ev.total) * 100 : 0}
			{@const isDone = ev.graded === ev.total}
			<button
				type="button"
				onclick={() => onSelect?.(ev)}
				class={cn(
					'group grid w-full grid-cols-12 items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel',
					active && 'ring-2 ring-accent'
				)}
			>
				<div class="col-span-5">
					<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
						{ev.subject}
					</p>
					<h3 class="mt-1 font-display text-lg font-semibold leading-tight">{ev.title}</h3>
					<p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
						<CalendarDays class="h-3 w-3" />
						{new Date(ev.date).toLocaleDateString($locale, {
							day: 'numeric',
							month: 'short',
							year: 'numeric',
						})}
					</p>
				</div>
				<div class="col-span-2">
					<p class="text-[11px] uppercase tracking-wider text-muted-foreground">
						{$t('eval.average')}
					</p>
					<p class="font-display text-2xl font-semibold tabular-nums">
						{isDone ? ev.averageMark.toFixed(1) : '—'}
						<span class="ml-1 text-xs font-normal text-muted-foreground">/ {ev.outOf}</span>
					</p>
				</div>
				<div class="col-span-2">
					<p class="text-[11px] uppercase tracking-wider text-muted-foreground">
						{$t('eval.coefficient')}
					</p>
					<p class="font-mono text-base">×{ev.coefficient}</p>
				</div>
				<div class="col-span-3">
					<div class="flex items-center justify-between text-[11px] text-muted-foreground">
						<span>{$t('eval.graded')}</span>
						<span class="font-mono">{ev.graded}/{ev.total}</span>
					</div>
					<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
						<div
							class={cn('h-full rounded-full', isDone ? 'bg-accent' : 'bg-highlight')}
							style:width="{progress}%"
						></div>
					</div>
				</div>
			</button>
		{/each}
		{#if evaluations.length === 0}
			<p
				class="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground"
			>
				{$t('eval.none')}
			</p>
		{/if}
	</div>
</div>
