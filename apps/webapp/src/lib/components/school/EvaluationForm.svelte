<script lang="ts">
	import type { Evaluation } from '$lib/types/school';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import { t } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import DrawerField from './DrawerField.svelte';

	const { s }: { s: Evaluation } = $props();

	const classStudents = $derived(detailDataContext.students.filter(st => st.classId === s.classId));
</script>

<div class="space-y-5">
	<div>
		<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.subject}</p>
		<h3 class="mt-1 font-display text-2xl font-semibold">{s.title}</h3>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<div class="rounded-xl bg-primary/10 p-4">
			<p class="text-[10px] uppercase tracking-wider text-muted-foreground">{$t('eval.average')}</p>
			<p class="font-display text-2xl">
				{s.averageMark.toFixed(1)}<span class="text-sm text-muted-foreground"> / {s.outOf}</span>
			</p>
		</div>
		<div class="rounded-xl bg-secondary p-4">
			<p class="text-[10px] uppercase tracking-wider text-muted-foreground">{$t('eval.graded')}</p>
			<p class="font-display text-2xl">{s.graded}/{s.total}</p>
		</div>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('eval.date')}>
			<Input type="date" value={s.date} />
		</DrawerField>
		<DrawerField label={$t('eval.coefficient')}>
			<Input type="number" step="0.5" value={String(s.coefficient)} />
		</DrawerField>
	</div>

	<div>
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
			{$t('eval.gradebook')}
		</Label>
		<div class="mt-2 overflow-hidden rounded-xl border border-border">
			{#each classStudents as st, i (st.id)}
				<div class={cn('flex items-center justify-between gap-3 px-3 py-2', i % 2 && 'bg-secondary/30')}>
					<div class="flex min-w-0 items-center gap-2">
						<div
							class="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-[10px] font-semibold text-primary-foreground"
						>
							{st.initials}
						</div>
						<span class="truncate text-xs">{st.name}</span>
					</div>
					<div class="flex items-center gap-1">
						<Input
							value={s.graded > 0 ? (Math.random() * s.outOf).toFixed(1) : ''}
							placeholder="—"
							class="h-7 w-14 rounded-md text-center text-xs"
						/>
						<span class="font-mono text-[10px] text-muted-foreground">/{s.outOf}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
