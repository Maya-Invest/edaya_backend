<script lang="ts">
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { t } from '$lib/i18n';
	import { Plus, Search } from '$lib/icons';
	import { readGradeScaleListFilters, writeGradeScaleListFilters } from '$lib/list/list-url-filters';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import GradeScaleFormModal from './GradeScaleFormModal.svelte';

	const initialFilters = $derived(readGradeScaleListFilters($page.url));

	let q = $state('');
	let filtersReady = $state(false);
	let createOpen = $state(false);

	const filteredScales = $derived(
		reportCardsContext.scales.filter((scale) => {
			const needle = q.trim().toLowerCase();
			if (!needle)
				return true;
			return scale.name.toLowerCase().includes(needle)
				|| (scale.description?.toLowerCase().includes(needle) ?? false);
		}),
	);

	function syncFiltersToUrl() {
		const href = writeGradeScaleListFilters($page.url, { q });
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
		eyebrow={$t('gradeScales.subtitle')}
		title={$t('gradeScales.title', { n: filteredScales.length })}
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
			<Button size="sm" class="rounded-full" onclick={() => (createOpen = true)}>
				<Plus class="mr-1 h-4 w-4" />
				{$t('gradeScales.add')}
			</Button>
		{/snippet}
	</ListPageHeader>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each filteredScales as scale (scale.id)}
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
