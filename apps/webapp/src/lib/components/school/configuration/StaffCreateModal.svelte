<script lang="ts">
	import { registerStaffMemberMutation } from '$lib/api/mutations/staff.mutations';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { t } from '$lib/i18n';
	import { get } from 'svelte/store';

	let {
		open = $bindable(false),
		onCreated,
	}: {
		open?: boolean;
		onCreated?: (staffId: string) => void;
	} = $props();

	let busy = $state(false);
	let firstName = $state('');
	let lastName = $state('');
	let email = $state('');

	function resetForm() {
		firstName = '';
		lastName = '';
		email = '';
	}

	const canSubmit = $derived(firstName.trim().length > 0 && lastName.trim().length > 0);

	async function submit() {
		if (!canSubmit)
			return;

		busy = true;
		const fullName = `${firstName.trim()} ${lastName.trim()}`;
		const staffId = await registerStaffMemberMutation({
			firstName,
			lastName,
			email,
			successMessage: get(t)('staff.createSuccess', { name: fullName }),
		});
		busy = false;
		if (staffId) {
			open = false;
			resetForm();
			onCreated?.(staffId);
		}
	}
</script>

<FormModal
	bind:open
	title={$t('staff.createTitle')}
	description={$t('staff.createDescription')}
	submitLabel={$t('common.save')}
	busy={busy}
	submitDisabled={!canSubmit}
	onCancel={resetForm}
	onSubmit={submit}
>
	<div class="grid gap-3 sm:grid-cols-2">
		<div class="space-y-1.5">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{$t('common.firstName')}
			</Label>
			<Input bind:value={firstName} autocomplete="given-name" />
		</div>
		<div class="space-y-1.5">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				{$t('common.lastName')}
			</Label>
			<Input bind:value={lastName} autocomplete="family-name" />
		</div>
	</div>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
			{$t('common.email')}
		</Label>
		<Input type="email" bind:value={email} autocomplete="email" />
	</div>
</FormModal>
