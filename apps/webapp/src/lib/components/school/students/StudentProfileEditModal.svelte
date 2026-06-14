<script lang="ts">
	import type { Student } from '$lib/types/school';
	import { updateStudentProfileMutation } from '$lib/api/mutations/student.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';

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
	let firstName = $state('');
	let lastName = $state('');
	let birthDate = $state('');

	function resetForm() {
		const parts = s.name.trim().split(/\s+/);
		firstName = parts.shift() ?? '';
		lastName = parts.join(' ');
		birthDate = s.birthdate;
	}

	$effect(() => {
		resetForm();
	});

	const canSubmit = $derived(firstName.trim().length > 0 && lastName.trim().length > 0);

	async function submit() {
		if (!canSubmit)
			return;

		busy = true;
		const ok = await updateStudentProfileMutation({
			studentId: s.id,
			firstName,
			lastName,
			birthDate,
			successMessage: `Profil de ${firstName.trim()} ${lastName.trim()} mis à jour.`,
		});
		busy = false;
		if (ok) {
			open = false;
		}
	}
</script>

<Button variant="outline" size="sm" class="rounded-full" {disabled} {title} onclick={() => (open = true)}>
	Modifier le profil
</Button>

<FormModal
	bind:open
	title={`Modifier le profil de ${s.name}`}
	description="Les contacts et tuteurs se modifient depuis leurs actions dédiées."
	submitLabel="Enregistrer"
	busy={busy}
	submitDisabled={!canSubmit}
	onCancel={resetForm}
	onSubmit={submit}
>
	<div class="grid gap-3 sm:grid-cols-2">
		<div class="space-y-1.5">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Prénom</Label>
			<Input bind:value={firstName} />
		</div>
		<div class="space-y-1.5">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Nom</Label>
			<Input bind:value={lastName} />
		</div>
	</div>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Date de naissance</Label>
		<Input type="date" bind:value={birthDate} />
	</div>
</FormModal>
