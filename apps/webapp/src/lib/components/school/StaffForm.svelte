<script lang="ts">
	import type { StaffMember, StaffRole } from '$lib/data/school';
	import { ROLE_LABEL_FR } from '$lib/permissions';
	import { t } from '$lib/i18n';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Select from '$lib/components/ui/select';
	import DrawerField from './DrawerField.svelte';
	import StaffPermissionsBlock from './StaffPermissionsBlock.svelte';

	let { s }: { s: StaffMember } = $props();

	let role = $state<StaffRole>(s.role);

	const roles: StaffRole[] = ['directeur', 'prof_principal', 'professeur', 'educateur'];
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
			onValueChange={(v) => v && (role = v as StaffRole)}
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

	<StaffPermissionsBlock {role} />
</div>
