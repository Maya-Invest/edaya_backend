<script lang="ts">
	import type { StaffMember } from '$lib/types/school';
	import { updateStaffMemberStatusMutation } from '$lib/api/mutations/staff.mutations';
	import { academicContext } from '$lib/academic/context.svelte';
	import Checkbox from '$lib/components/ui/checkbox/checkbox.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import PermissionGate from '$lib/components/ui/PermissionGate.svelte';
	import { t } from '$lib/i18n';
	import { Mail } from '$lib/icons';
	import { cn } from '$lib/utils';
	import { get } from 'svelte/store';
	import DrawerField from '../shared/DrawerField.svelte';
	import StaffPermissionsList from './StaffPermissionsList.svelte';

	const { s }: { s: StaffMember } = $props();

	let tab = $state<'profile' | 'permissions'>('profile');
	let optimisticActive = $state<boolean | null>(null);
	let statusBusy = $state(false);

	const active = $derived(optimisticActive ?? s.isActive);

	const classLabels = $derived(
		s.classes.map(id => academicContext.classes.find(c => c.id === id)?.name ?? id),
	);

	async function handleActiveChange(checked: boolean | 'indeterminate') {
		if (checked === 'indeterminate' || statusBusy)
			return;

		const previous = active;
		optimisticActive = checked;
		statusBusy = true;
		const ok = await updateStaffMemberStatusMutation({
			staffId: s.id,
			isActive: checked,
			successMessage: get(t)(
				checked ? 'staff.activateSuccess' : 'staff.deactivateSuccess',
				{ name: s.name },
			),
		});
		statusBusy = false;
		if (ok) {
			optimisticActive = null;
		}
		else {
			optimisticActive = previous;
		}
	}
</script>

<div class="space-y-5">
	<div class="flex items-center gap-4">
		<div
			class="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary font-display text-lg font-semibold text-primary-foreground"
		>
			{s.initials}
		</div>
		<div>
			<h3 class="font-display text-2xl font-semibold leading-tight">{s.name}</h3>
			<p class="text-sm text-muted-foreground">
				{$t(`staff.role.${s.role}`)} · {s.department}
			</p>
		</div>
	</div>

	<div class="flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-1 text-xs">
		{#each ['profile', 'permissions'] as const as k (k)}
			<button
				type="button"
				onclick={() => (tab = k)}
				class={cn(
					'flex-1 rounded-full px-3 py-1.5 font-medium transition',
					tab === k ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
				)}
			>
				{$t(k === 'profile' ? 'drawer.tab.profile' : 'drawer.tab.permissions')}
			</button>
		{/each}
	</div>

	{#if tab === 'profile'}
		<div class="space-y-4">
			<DrawerField label={$t('guardian.fullName')}>
				<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.name}</div>
			</DrawerField>
			<DrawerField label={$t('common.email')}>
				<div class="flex min-h-10 items-center gap-2 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">
					<Mail class="h-3.5 w-3.5 text-muted-foreground" />
					{s.email || '—'}
				</div>
			</DrawerField>
			<DrawerField label={$t('people.role')}>
				<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">
					{$t(`staff.role.${s.role}`)}
				</div>
			</DrawerField>
			<DrawerField label={$t('people.department')}>
				<div class="min-h-10 rounded-md border border-input bg-secondary/30 px-3 py-2 text-sm">{s.department}</div>
			</DrawerField>

			{#if s.subjectLabels && s.subjectLabels.length > 0}
				<DrawerField label={$t('reportCards.subjects')}>
					<p class="text-sm text-muted-foreground">{s.subjectLabels.join(', ')}</p>
				</DrawerField>
			{/if}

			{#if classLabels.length > 0}
				<DrawerField label={$t('staff.assignedClasses')}>
					<div class="flex flex-wrap gap-1.5">
						{#each classLabels as label (label)}
							<span
								class="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
							>
								{label}
							</span>
						{/each}
					</div>
				</DrawerField>
			{/if}

			<div class="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
				<div>
					<Label class="text-sm font-medium">{$t('staff.activeLabel')}</Label>
					<p class="text-xs text-muted-foreground">{$t('staff.activeHint')}</p>
				</div>
				<PermissionGate permission="STAFF_UPDATE" mode="disable" tooltip={$t('staff.permissionUpdate')}>
					{#snippet children({ disabled })}
						<Checkbox
							checked={active}
							disabled={disabled || statusBusy}
							onCheckedChange={handleActiveChange}
						/>
					{/snippet}
				</PermissionGate>
			</div>
		</div>
	{:else}
		<StaffPermissionsList {s} />
	{/if}
</div>
