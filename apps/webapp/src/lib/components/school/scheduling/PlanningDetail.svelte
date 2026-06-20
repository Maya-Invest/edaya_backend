<script lang="ts">
	import type { PlanningEvent } from '$lib/types/school';
	import { t } from '$lib/i18n';
	import { MapPin } from '$lib/icons';
	import DrawerActionBar from '../shared/DrawerActionBar.svelte';
	import DrawerField from '../shared/DrawerField.svelte';
	import PermissionGate from '$lib/components/ui/PermissionGate.svelte';
	import PlanningFormModal from './PlanningFormModal.svelte';

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
		<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.title}</div>
	</DrawerField>
	<DrawerField label={$t('drawer.subject')}>
		<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.subject}</div>
	</DrawerField>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('drawer.start')}>
			<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.start}</div>
		</DrawerField>
		<DrawerField label={$t('drawer.end')}>
			<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.end}</div>
		</DrawerField>
	</div>
	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('drawer.room')}>
			<div class="flex min-h-10 items-center gap-2 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">
				<MapPin class="h-3.5 w-3.5 text-muted-foreground" />
				{s.room}
			</div>
		</DrawerField>
		<DrawerField label={$t('subjects.teacher')}>
			<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.teacher}</div>
		</DrawerField>
	</div>

	<DrawerActionBar>
		<PermissionGate
			permission="TIMETABLE_UPDATE"
			classId={s.classId}
			mode="disable"
			tooltip={$t('calendar.permissionUpdate')}
		>
			{#snippet children({ disabled, title })}
				<PlanningFormModal event={s} {disabled} {title} />
			{/snippet}
		</PermissionGate>
	</DrawerActionBar>
</div>
