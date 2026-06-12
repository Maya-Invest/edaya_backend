<script lang="ts">
	import type { StaffMember, StaffRole } from '$lib/types/school';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Select from '$lib/components/ui/select';
	import { t } from '$lib/i18n';
	import { ROLE_LABEL_FR } from '$lib/permissions';
	import DrawerField from './DrawerField.svelte';
	import StaffPermissionsBlock from './StaffPermissionsBlock.svelte';

	const { s }: { s: StaffMember } = $props();

	const roles: StaffRole[] = ['directeur', 'prof_principal', 'professeur', 'educateur'];

	let role = $derived(s.role);
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
			<p class="text-sm text-muted-foreground">{ROLE_LABEL_FR[role]}</p>
		</div>
	</div>
	<DrawerField label={$t('guardian.fullName')}>
		<Input value={s.name} />
	</DrawerField>
	<DrawerField label={$t('common.email')}>
		<Input value={s.email} />
	</DrawerField>

	<DrawerField label={$t('people.role')}>
		<Select.Root
			type="single"
			value={role}
			onValueChange={v => v && (role = v as StaffRole)}
		>
			<Select.Trigger>
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				{#each roles as r (r)}
					<Select.Item value={r}>{ROLE_LABEL_FR[r]}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</DrawerField>

	<DrawerField label={$t('people.department')}>
		<Input value={s.department} readonly class="bg-secondary/30" />
	</DrawerField>

	{#if s.subjectLabels && s.subjectLabels.length > 0}
		<DrawerField label={$t('reportCards.subjects')}>
			<p class="text-sm text-muted-foreground">{s.subjectLabels.join(', ')}</p>
		</DrawerField>
	{/if}

	<StaffPermissionsBlock {role} />
</div>
