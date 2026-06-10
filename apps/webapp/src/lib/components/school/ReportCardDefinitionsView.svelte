<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import type { ReportCardDefinition } from '$lib/data/report-cards';
	import { gradeScaleById } from '$lib/data/report-cards';
	import { gradeLevelById } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import { t } from '$lib/i18n';

	let {
		definitions,
		onSelect,
		selectedId
	}: {
		definitions: ReportCardDefinition[];
		onSelect?: (d: ReportCardDefinition) => void;
		selectedId?: string;
	} = $props();

	const sectionKindLabel: Record<string, string> = {
		matieres: 'Matières',
		synthese: 'Synthèse',
		appreciation: 'Appréciations'
	};
</script>

<div class="animate-fade-in">
	<div class="mb-5">
		<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
			{$t('reportCards.subtitle')}
		</p>
		<h2 class="font-display text-2xl font-semibold">
			{$t('reportCards.modelsTitle', { n: definitions.length })}
		</h2>
	</div>

	<div class="space-y-2">
		{#each definitions as def (def.id)}
			{@const level = gradeLevelById(def.gradeLevelId)}
			{@const scale = gradeScaleById(def.gradeScaleId)}
			<button
				type="button"
				onclick={() => onSelect?.(def)}
				class={cn(
					'flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left shadow-soft transition hover:bg-secondary/40',
					selectedId === def.id && 'border-primary/40 bg-primary/5'
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
									: 'bg-secondary text-muted-foreground'
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
