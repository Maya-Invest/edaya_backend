<script lang="ts">
	import { Plus } from 'lucide-svelte';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { cn } from '$lib/utils';
	import { get } from 'svelte/store';

	let showCreate = $state(false);
	let name = $state('');
	let minScore = $state('0');
	let maxScore = $state('20');
	let passingScore = $state('10');
	let decimalPlaces = $state('2');
	let description = $state('');

	function handleCreate() {
		const scale = reportCardsContext.addGradeScale({
			name,
			minScore: Number(minScore),
			maxScore: Number(maxScore),
			passingScore: Number(passingScore),
			decimalPlaces: Number(decimalPlaces),
			description
		});
		showCreate = false;
		name = '';
		description = '';
		toast.success(get(t)('gradeScales.toastCreated', { name: scale.name }));
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('gradeScales.subtitle')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('gradeScales.title', { n: reportCardsContext.scales.length })}
			</h2>
		</div>
		<Button class="rounded-full" onclick={() => (showCreate = !showCreate)}>
			<Plus class="h-4 w-4" />
			{$t('gradeScales.add')}
		</Button>
	</div>

	{#if showCreate}
		<form
			class="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft"
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
		>
			<p class="mb-4 font-display text-sm font-semibold">{$t('gradeScales.add')}</p>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('gradeScales.name')}</span>
					<Input bind:value={name} placeholder="Sur 20" class="rounded-xl" required />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('gradeScales.min')}</span>
					<Input type="number" bind:value={minScore} class="rounded-xl" />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('gradeScales.max')}</span>
					<Input type="number" bind:value={maxScore} class="rounded-xl" />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('gradeScales.passing')}</span>
					<Input type="number" bind:value={passingScore} class="rounded-xl" />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('gradeScales.decimals')}</span>
					<Input type="number" min="0" max="3" bind:value={decimalPlaces} class="rounded-xl" />
				</label>
				<label class="col-span-full space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('gradeScales.description')}</span>
					<Input bind:value={description} class="rounded-xl" />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" class="rounded-full" onclick={() => (showCreate = false)}>
					{$t('academic.cancel')}
				</Button>
				<Button type="submit" class="rounded-full">{$t('academic.save')}</Button>
			</div>
		</form>
	{/if}

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
