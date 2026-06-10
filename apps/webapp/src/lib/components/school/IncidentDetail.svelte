<script lang="ts">
	import type { Incident } from '$lib/data/school';
	import { students, classes } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import { locale, t } from '$lib/i18n';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import DrawerField from './DrawerField.svelte';
	import { incidentSevTone, incidentCatTone } from './drawer-constants';

	let { i }: { i: Incident } = $props();

	const student = $derived(students.find((s) => s.id === i.studentId));
	const cls = $derived(classes.find((c) => c.id === student?.classId));
</script>

<div class="space-y-5">
	<div>
		<div class="flex flex-wrap items-center gap-2">
			<span
				class={cn(
					'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
					incidentSevTone[i.severity]
				)}
			>
				{$t(`events.severity.${i.severity}`)}
			</span>
			<span class={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', incidentCatTone[i.category])}>
				{$t(`events.cat.${i.category}`)}
			</span>
		</div>
		<h3 class="mt-2 font-display text-2xl font-semibold leading-tight">{i.summary}</h3>
		<p class="mt-1 font-mono text-xs text-muted-foreground">
			{new Date(i.date).toLocaleDateString($locale, { day: 'numeric', month: 'long', year: 'numeric' })}
		</p>
	</div>

	{#if student}
		<div class="flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 p-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-display text-sm font-semibold text-primary-foreground"
			>
				{student.initials}
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm font-medium">{student.name}</p>
				<p class="truncate text-xs text-muted-foreground">{cls?.name} · {cls?.level}</p>
			</div>
		</div>
	{/if}

	<DrawerField label={$t('events.summary')}>
		<Textarea value={i.summary} rows={3} />
	</DrawerField>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('events.date')}>
			<Input type="date" value={i.date} />
		</DrawerField>
		<DrawerField label={$t('events.category')}>
			<Input value={$t(`events.cat.${i.category}`)} />
		</DrawerField>
	</div>
	<DrawerField label={$t('events.severity')}>
		<Input value={$t(`events.severity.${i.severity}`)} />
	</DrawerField>
	<DrawerField label={$locale === 'fr' ? 'Détails' : 'Details'}>
		<Textarea
			rows={4}
			placeholder={$locale === 'fr' ? 'Ajouter des détails complémentaires…' : 'Add additional details…'}
		/>
	</DrawerField>
</div>
