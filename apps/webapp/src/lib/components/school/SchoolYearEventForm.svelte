<script lang="ts">
	import type { SchoolYearEvent } from '$lib/data/school';
	import { classes } from '$lib/data/school';
	import { locale, t } from '$lib/i18n';
	import Input from '$lib/components/ui/input/input.svelte';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import DrawerField from './DrawerField.svelte';

	let { ev }: { ev: SchoolYearEvent } = $props();

	let scoped = $state(false);
	let selectedClasses = $state<string[]>([]);
	$effect.pre(() => {
		scoped = ev.scope !== 'all';
		selectedClasses = ev.scope === 'all' ? [] : [...ev.scope];
	});

	const calTypeKey: Record<SchoolYearEvent['type'], string> = {
		holiday: 'calType.holiday',
		vacation: 'calType.vacation',
		closure: 'calType.closure',
		ceremony: 'calType.ceremony',
	};

	function toggleClass(id: string) {
		selectedClasses = selectedClasses.includes(id)
			? selectedClasses.filter((c) => c !== id)
			: [...selectedClasses, id];
	}
</script>

<div class="space-y-5">
	<div>
		<span
			class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			{$t(calTypeKey[ev.type])}
		</span>
		<h3 class="mt-2 font-display text-2xl font-semibold">{ev.title}</h3>
		<p class="mt-1 font-mono text-xs text-muted-foreground">
			{new Date(ev.date).toLocaleDateString($locale, { day: 'numeric', month: 'long', year: 'numeric' })}
			{#if ev.endDate}
				— {new Date(ev.endDate).toLocaleDateString($locale, {
					day: 'numeric',
					month: 'long',
					year: 'numeric',
				})}
			{/if}
		</p>
	</div>
	<DrawerField label={$t('drawer.title')}>
		<Input value={ev.title} />
	</DrawerField>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('drawer.start')}>
			<Input type="date" value={ev.date} />
		</DrawerField>
		<DrawerField label={$t('drawer.end')}>
			<Input type="date" value={ev.endDate ?? ev.date} />
		</DrawerField>
	</div>
	<DrawerField label={$t('cal.typeLabel')}>
		<Input value={$t(calTypeKey[ev.type])} />
	</DrawerField>

	<div class="space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
		<label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
			<Checkbox checked={scoped} onCheckedChange={(v) => (scoped = v === true)} />
			Champ d'application restreint à certaines classes
		</label>
		<p class="text-xs text-muted-foreground">
			{scoped
				? 'Sélectionnez les classes concernées par cet évènement.'
				: 'Toutes les classes seront concernées par cet évènement.'}
		</p>
		{#if scoped}
			<div class="grid grid-cols-2 gap-2 pt-1">
				{#each classes as c (c.id)}
					<label
						class="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
					>
						<Checkbox
							checked={selectedClasses.includes(c.id)}
							onCheckedChange={() => toggleClass(c.id)}
						/>
						<span class="font-medium">{c.name}</span>
						<span class="text-muted-foreground">· {c.level}</span>
					</label>
				{/each}
			</div>
		{/if}
	</div>

	<DrawerField label={$t('drawer.notes')}>
		<Textarea value={ev.description} rows={4} />
	</DrawerField>
</div>
