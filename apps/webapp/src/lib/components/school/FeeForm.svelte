<script lang="ts">
	import type { Fee } from '$lib/types/school';
	import Input from '$lib/components/ui/input/input.svelte';
	import { t } from '$lib/i18n';
	import DrawerField from './DrawerField.svelte';

	const { f }: { f: Fee } = $props();

	const periodLowerKey = $derived(
		f.period.toLowerCase() === 'year' ? 'year' : f.period.toLowerCase() === 'term' ? 'term' : 'month',
	);
</script>

<div class="space-y-5">
	<div>
		<span
			class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			{$t(`feeCat.${f.category}`)}
		</span>
		<h3 class="mt-2 font-display text-2xl font-semibold">{f.name}</h3>
		<p class="mt-1 font-display text-3xl font-semibold tabular-nums">
			{f.amount.toLocaleString()} FCFA
			<span class="text-sm font-normal text-muted-foreground">/ {$t(`feePeriod.${periodLowerKey}`)}</span>
		</p>
	</div>
	<DrawerField label={$t('fee.name')}>
		<Input value={f.name} />
	</DrawerField>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('fee.category')}>
			<Input value={$t(`feeCat.${f.category}`)} />
		</DrawerField>
		<DrawerField label={$t('fee.period')}>
			<Input value={$t(`feePeriod.${f.period}`)} />
		</DrawerField>
	</div>
	<DrawerField label={$t('fee.amount')}>
		<Input type="number" value={String(f.amount)} />
	</DrawerField>
</div>
