<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { t } from '$lib/i18n';
	import { Plus } from '$lib/icons';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import GradeScaleFormModal from './GradeScaleFormModal.svelte';

	let createOpen = $state(false);
</script>

<div class="animate-fade-in">
	<ListPageHeader
		eyebrow={$t('gradeScales.subtitle')}
		title={$t('gradeScales.title', { n: reportCardsContext.scales.length })}
	>
		{#snippet primary()}
			<Button size="sm" class="rounded-full" onclick={() => (createOpen = true)}>
				<Plus class="mr-1 h-4 w-4" />
				{$t('gradeScales.add')}
			</Button>
		{/snippet}
	</ListPageHeader>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each reportCardsContext.scales as scale (scale.id)}
			<article class="rounded-2xl border border-border bg-card p-5 shadow-soft">
				<div class="mb-2 flex items-start justify-between gap-2">
					<h3 class="font-display font-semibold">{scale.name}</h3>
					{#if scale.isDefault}
						<span class="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase">
							{$t('gradeScales.default')}
						</span>
					{/if}
				</div>
				<p class="font-mono text-sm text-muted-foreground">
					{scale.minScore} → {scale.maxScore} · {$t('gradeScales.passing')} {scale.passingScore}
				</p>
				{#if scale.description}
					<p class="mt-2 text-sm text-muted-foreground">{scale.description}</p>
				{/if}
			</article>
		{/each}
	</div>
</div>

<GradeScaleFormModal bind:open={createOpen} />
