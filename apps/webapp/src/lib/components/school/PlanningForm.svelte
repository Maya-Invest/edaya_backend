<script lang="ts">
	import type { PlanningEvent } from '$lib/types/school';
	import Input from '$lib/components/ui/input/input.svelte';
	import { t } from '$lib/i18n';
	import DrawerField from './DrawerField.svelte';

	const { s }: { s: PlanningEvent } = $props();
</script>

<div class="space-y-5">
	<div>
		<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
			{$t(`day.full.${s.day}`)} · {s.start} — {s.end}
		</p>
		<h3 class="mt-1 font-display text-2xl font-semibold">{s.title}</h3>
	</div>
	<DrawerField label={$t('drawer.title')}>
		<Input value={s.title} />
	</DrawerField>
	<DrawerField label={$t('drawer.subject') || 'Subject'}>
		<Input value={s.subject} />
	</DrawerField>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('drawer.start')}>
			<Input type="time" value={s.start} />
		</DrawerField>
		<DrawerField label={$t('drawer.end')}>
			<Input type="time" value={s.end} />
		</DrawerField>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('drawer.room')}>
			<Input value={s.room} />
		</DrawerField>
		<DrawerField label={$t('subjects.teacher')}>
			<Input value={s.teacher} />
		</DrawerField>
	</div>
</div>
