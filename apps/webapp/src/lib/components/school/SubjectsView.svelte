<script lang="ts">
	import { Clock, Plus, User } from '$lib/icons';
	import type { Subject, SubjectCategory } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';

	let {
		subjects,
		onSelect,
		selectedId,
		getProgress,
	}: {
		subjects: Subject[];
		onSelect?: (s: Subject) => void;
		selectedId?: string;
		getProgress?: (s: Subject) => number;
	} = $props();

	const dotColor: Record<Subject['color'], string> = {
		mint: 'bg-accent',
		sky: 'bg-accent/60',
		warm: 'bg-muted-foreground/40',
	};

	const categoryTone: Record<SubjectCategory, string> = {
		Scientifique: 'bg-secondary text-foreground/80',
		Littéraire: 'bg-secondary text-foreground/80',
		Langues: 'bg-secondary text-foreground/80',
		'Sciences humaines': 'bg-secondary text-foreground/80',
		Sport: 'bg-secondary text-foreground/80',
		Arts: 'bg-secondary text-foreground/80',
	};
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('subjects.curriculum')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('subjects.count', { n: subjects.length })}
			</h2>
		</div>
		<Button size="sm" class="rounded-full">
			<Plus class="mr-1 h-4 w-4" />
			{$t('subjects.newSubject')}
		</Button>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		{#each subjects as s, idx (s.id)}
			{@const active = selectedId === s.id}
			{@const progress = getProgress?.(s)}
			<button
				type="button"
				onclick={() => onSelect?.(s)}
				class={cn(
					'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary',
					idx !== subjects.length - 1 && 'border-b border-border',
					active && 'bg-secondary'
				)}
			>
				<div class={cn('h-8 w-1.5 shrink-0 rounded-full', dotColor[s.color])}></div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="font-display text-sm font-semibold">{s.name}</span>
						<span
							class={cn(
								'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
								categoryTone[s.category]
							)}
						>
							{s.category}
						</span>
					</div>
					<p class="mt-0.5 truncate text-xs text-muted-foreground">{s.description}</p>
				</div>
				<div class="flex shrink-0 items-center gap-5 text-xs text-muted-foreground">
					{#if getProgress && progress !== undefined}
						<span class="flex items-center gap-2">
							<span class="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
								<span class="block h-full bg-accent" style:width="{progress}%"></span>
							</span>
							<span class="font-mono tabular-nums">{progress}%</span>
						</span>
					{/if}
					<span class="flex items-center gap-1.5">
						<User class="h-3.5 w-3.5" />
						{s.teacher}
					</span>
					<span class="flex items-center gap-1.5">
						<Clock class="h-3.5 w-3.5" />
						{s.hoursPerWeek}h
					</span>
				</div>
			</button>
		{/each}
		{#if subjects.length === 0}
			<p class="px-5 py-10 text-center text-sm text-muted-foreground">{$t('subjects.none')}</p>
		{/if}
	</div>
</div>
