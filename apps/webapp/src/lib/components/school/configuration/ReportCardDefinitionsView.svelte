<script lang="ts">
	import type { ReportCardDefinition } from '$lib/types/report-cards';
	import { academicContext } from '$lib/academic/context.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { t } from '$lib/i18n';
	import { ChevronRight } from '$lib/icons';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import { cn } from '$lib/utils';

	const {
		definitions,
		onSelect,
		selectedId,
	}: {
		definitions: ReportCardDefinition[];
		onSelect?: (d: ReportCardDefinition) => void;
		selectedId?: string;
	} = $props();
</script>

<div class="animate-fade-in">
	<ListPageHeader
		eyebrow={$t('reportCards.subtitle')}
		title={$t('reportCards.modelsTitle', { n: definitions.length })}
	/>

	<div class="space-y-2">
		{#each definitions as def (def.id)}
			{@const level = academicContext.gradeLevelById(def.gradeLevelId)}
			{@const scale = reportCardsContext.scales.find(s => s.id === def.gradeScaleId)}
			<button
				type="button"
				onclick={() => onSelect?.(def)}
				class={cn(
					'flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-soft transition hover:bg-secondary/40',
					selectedId === def.id && 'border-primary/40 bg-primary/5',
				)}
			>
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<p class="font-display font-semibold">{def.name}</p>
						<span
							class={cn(
								'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase',
								def.status === 'published'
									? 'bg-accent/15 text-accent-foreground'
									: 'bg-secondary text-muted-foreground',
							)}
						>
							{def.status === 'published' ? $t('academic.published') : $t('academic.draft')}
						</span>
					</div>
					<p class="mt-1 text-sm text-muted-foreground">
						{level?.name ?? '—'} · {scale?.name ?? '—'} · {def.sections.length} section{def.sections.length > 1 ? 's' : ''}
					</p>
				</div>
				<ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
			</button>
		{/each}
	</div>
</div>
