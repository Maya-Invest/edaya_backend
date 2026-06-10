<script lang="ts">
	import { Plus } from '$lib/icons';
	import { resources } from '$lib/data/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils';
	import { t } from '$lib/i18n';
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('resources.eyebrow')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('resources.count', { n: resources.length })}
			</h2>
		</div>
		<Button size="sm" class="rounded-full">
			<Plus class="mr-1 h-4 w-4" />
			{$t('resources.newResource')}
		</Button>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-4">{$t('resources.name')}</div>
			<div class="col-span-2">{$t('resources.type')}</div>
			<div class="col-span-3">{$t('resources.location')}</div>
			<div class="col-span-2">{$t('resources.capacity')}</div>
			<div class="col-span-1 text-right">{$t('resources.status')}</div>
		</div>
		<ul>
			{#each resources as r (r.id)}
				<li
					class="grid grid-cols-12 items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0 hover:bg-secondary"
				>
					<div class="col-span-4 text-sm font-medium">{r.name}</div>
					<div class="col-span-2">
						<span
							class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							{$t(`resourceType.${r.type}`)}
						</span>
					</div>
					<div class="col-span-3 text-sm text-foreground/70">{r.location}</div>
					<div class="col-span-2 font-mono text-xs">
						{r.capacity ? $t('resources.pax', { n: r.capacity }) : '—'}
					</div>
					<div class="col-span-1 flex justify-end">
						<span
							class={cn(
								'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
								r.status === 'available' && 'bg-secondary text-foreground/80',
								r.status === 'booked' && 'bg-secondary text-foreground/80',
								r.status === 'maintenance' && 'bg-destructive/10 text-destructive'
							)}
						>
							{$t(`resourceStatus.${r.status}`)}
						</span>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>
