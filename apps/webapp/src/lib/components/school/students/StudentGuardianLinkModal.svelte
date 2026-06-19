<script lang="ts">
	import type { Student } from '$lib/types/school';
	import { linkGuardianToStudentMutation } from '$lib/api/mutations/student.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import PickerModal from '$lib/components/ui/PickerModal.svelte';
	import * as Select from '$lib/components/ui/select';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import { t } from '$lib/i18n';

	const {
		s,
		disabled = false,
		title,
	}: {
		s: Student;
		disabled?: boolean;
		title?: string;
	} = $props();

	let open = $state(false);
	let busy = $state(false);
	let guardianId = $state('');

	const available = $derived(detailDataContext.guardians.filter(g => !g.studentIds.includes(s.id)));
	const selectedGuardian = $derived(available.find(g => g.id === guardianId));
	const selectedGuardianLabel = $derived(
		selectedGuardian
			? `${selectedGuardian.name}${selectedGuardian.email ? ` · ${selectedGuardian.email}` : selectedGuardian.phone ? ` · ${selectedGuardian.phone}` : ''}`
			: '',
	);

	let wasOpen = $state(false);

	function resetPicker() {
		guardianId = available[0]?.id ?? '';
	}

	$effect(() => {
		if (open && !wasOpen)
			resetPicker();
		wasOpen = open;
	});

	async function confirm() {
		if (!guardianId)
			return;

		busy = true;
		const ok = await linkGuardianToStudentMutation({
			guardianId,
			studentId: s.id,
			successMessage: `${selectedGuardian?.name ?? 'Le tuteur'} a été rattaché à ${s.name}.`,
		});
		busy = false;
		if (ok) {
			open = false;
			guardianId = '';
		}
	}
</script>

<Button
	variant="ghost"
	class="w-full rounded-full border border-dashed border-border"
	{disabled}
	{title}
	onclick={() => (open = true)}
>
	Rattacher un tuteur
</Button>

<PickerModal
	bind:open
	title={`Rattacher un tuteur à ${s.name}`}
	description="Choisissez un tuteur existant à associer au dossier de l’élève."
	confirmLabel="Rattacher"
	busy={busy}
	confirmDisabled={!guardianId || available.length === 0}
	onCancel={resetPicker}
	onConfirm={confirm}
>
	{#if available.length === 0}
		<p class="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
			Tous les tuteurs connus sont déjà rattachés à cet élève.
		</p>
	{:else}
		<div class="space-y-1.5">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tuteur</Label>
			<Select.Root type="single" value={guardianId} onValueChange={v => v && (guardianId = v)}>
				<Select.Trigger>
					<Select.Value placeholder={$t('guardian.selectGuardian')}>
						{selectedGuardianLabel}
					</Select.Value>
				</Select.Trigger>
				<Select.Content class="z-[100]">
					{#each available as guardian (guardian.id)}
						<Select.Item value={guardian.id} label={guardian.name}>
							{guardian.name}
							<span class="ml-1 text-muted-foreground">· {guardian.email || guardian.phone}</span>
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	{/if}
</PickerModal>
