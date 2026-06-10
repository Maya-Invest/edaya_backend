<script lang="ts">
	import { Plus, CalendarRange, Users } from '$lib/icons';
	import type { Activity } from '$lib/data/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils';
	import { t } from '$lib/i18n';

	let {
		activities,
		onSelect,
		selectedId,
	}: {
		activities: Activity[];
		onSelect?: (a: Activity) => void;
		selectedId?: string;
	} = $props();

	const catTone: Record<Activity['category'], string> = {
		Sport: 'bg-secondary text-foreground/80',
		Arts: 'bg-secondary text-foreground/80',
		Science: 'bg-secondary text-foreground/80',
		Language: 'bg-secondary text-foreground/80',
		Wellbeing: 'bg-secondary text-foreground/80',
	};

	function fmtDate(d: string) {
		return new Date(d).toLocaleDateString('fr-FR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('activities.eyebrow')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('activities.count', { n: activities.length })}
			</h2>
		</div>
		<Button size="sm" class="rounded-full">
			<Plus class="mr-1 h-4 w-4" />
			{$t('activities.newActivity')}
		</Button>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-[1.6fr_2fr_1.2fr_0.6fr] gap-4 border-b border-border bg-secondary/40 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
		>
			<span>Activité</span>
			<span>Description</span>
			<span>Période</span>
			<span class="text-right">Inscrits</span>
		</div>
		<ul class="divide-y divide-border">
			{#each activities as a (a.id)}
				{@const isSelected = a.id === selectedId}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(a)}
						class={cn(
							'grid w-full grid-cols-[1.6fr_2fr_1.2fr_0.6fr] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-secondary',
							isSelected && 'bg-secondary/60'
						)}
					>
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<span
									class={cn(
										'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
										catTone[a.category]
									)}
								>
									{$t(`activities.cat.${a.category}`)}
								</span>
							</div>
							<p class="mt-1 truncate font-display text-sm font-semibold">{a.name}</p>
							<p class="truncate text-xs text-muted-foreground">{a.coach} · {a.schedule}</p>
						</div>
						<p class="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
						<div class="flex items-center gap-1.5 text-xs text-foreground/80">
							<CalendarRange class="h-3.5 w-3.5 text-muted-foreground" />
							<span class="font-mono tabular-nums"
								>{fmtDate(a.startDate)} → {fmtDate(a.endDate)}</span
							>
						</div>
						<div class="flex items-center justify-end gap-1 text-xs">
							<Users class="h-3.5 w-3.5 text-muted-foreground" />
							<span class="font-mono tabular-nums">{a.enrollments.length}/{a.capacity}</span>
						</div>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</div>
