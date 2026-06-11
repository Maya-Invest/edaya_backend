<script lang="ts">
	import { academicContext } from '$lib/academic/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { periodDefinitionById } from '$lib/data/school';
	import { t } from '$lib/i18n';
	import { CalendarRange, ChevronDown, Plus } from '$lib/icons';
	import { toast } from '$lib/toast.svelte';
	import { cn } from '$lib/utils';
	import { get } from 'svelte/store';

	let showCreate = $state(false);
	let label = $state('');
	let startDate = $state('2027-09-01');
	let endDate = $state('2028-07-02');
	let expandedYear = $state<string | null>(academicContext.yearId);

	const sortedYears = $derived(
		[...academicContext.years].sort((a, b) => b.startDate.localeCompare(a.startDate)),
	);

	function periodsFor(yearId: string) {
		return academicContext.periods
			.filter(p => p.academicYearId === yearId)
			.sort((a, b) => a.startDate.localeCompare(b.startDate));
	}

	function handleCreate() {
		const year = academicContext.createYear(label, startDate, endDate);
		showCreate = false;
		label = '';
		expandedYear = year.id;
		toast.success(get(t)('academic.toastYearCreated', { label: year.label }));
	}

	function handlePublishYear(yearId: string) {
		const year = academicContext.publishYear(yearId);
		if (year)
			toast.success(get(t)('academic.toastYearPublished', { label: year.label }));
	}

	function handlePublishPeriod(periodId: string) {
		const period = academicContext.publishPeriod(periodId);
		if (period)
			toast.success(get(t)('academic.toastPeriodPublished', { label: period.label }));
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('academic.subtitle')}
			</p>
			<h2 class="font-display text-2xl font-semibold">{$t('academic.title')}</h2>
		</div>
		<Button class="rounded-full" onclick={() => (showCreate = !showCreate)}>
			<Plus class="h-4 w-4" />
			{$t('academic.createYear')}
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
			<p class="mb-4 font-display text-sm font-semibold">{$t('academic.createYear')}</p>
			<div class="grid gap-4 sm:grid-cols-3">
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('academic.yearLabel')}</span>
					<Input bind:value={label} placeholder="2027 — 2028" class="rounded-xl" />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('academic.startDate')}</span>
					<Input type="date" bind:value={startDate} class="rounded-xl" />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('academic.endDate')}</span>
					<Input type="date" bind:value={endDate} class="rounded-xl" />
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

	<div class="space-y-3">
		{#each sortedYears as year (year.id)}
			{@const open = expandedYear === year.id}
			{@const yearPeriods = periodsFor(year.id)}
			<section class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
				<button
					type="button"
					class="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-secondary/40"
					onclick={() => (expandedYear = open ? null : year.id)}
				>
					<CalendarRange class="h-4 w-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="font-display font-semibold">{year.label}</h3>
							<span
								class={cn(
									'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide',
									year.status === 'published'
										? 'bg-accent/15 text-accent-foreground'
										: 'bg-secondary text-muted-foreground',
								)}
							>
								{year.status === 'published' ? $t('academic.published') : $t('academic.draft')}
							</span>
						</div>
						<p class="mt-0.5 font-mono text-xs text-muted-foreground">
							{year.startDate} → {year.endDate}
						</p>
					</div>
					<ChevronDown class={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
				</button>

				{#if open}
					<div class="border-t border-border px-5 py-4">
						{#if year.status === 'draft'}
							<div class="mb-4 flex justify-end">
								<Button
									size="sm"
									class="rounded-full"
									onclick={() => handlePublishYear(year.id)}
								>
									{$t('academic.publishYear')}
								</Button>
							</div>
						{/if}

						<p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
							{$t('academic.periods')}
						</p>
						<ul class="space-y-2">
							{#each yearPeriods as period (period.id)}
								{@const def = periodDefinitionById(period.periodDefinitionId)}
								<li
									class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3"
								>
									<div>
										<p class="text-sm font-medium">
											{period.label}
											{#if def}
												<span class="ml-2 text-xs text-muted-foreground">({def.name})</span>
											{/if}
										</p>
										<p class="font-mono text-[11px] text-muted-foreground">
											{period.range} · {period.startDate} → {period.endDate}
										</p>
									</div>
									<div class="flex items-center gap-2">
										<span
											class={cn(
												'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase',
												period.status === 'published'
													? 'bg-accent/15 text-accent-foreground'
													: 'bg-secondary text-muted-foreground',
											)}
										>
											{period.status === 'published'
												? $t('academic.published')
												: $t('academic.draft')}
										</span>
										{#if period.status === 'draft'}
											<Button
												size="sm"
												variant="outline"
												class="rounded-full"
												onclick={() => handlePublishPeriod(period.id)}
											>
												{$t('academic.publishPeriod')}
											</Button>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</section>
		{/each}
	</div>
</div>
