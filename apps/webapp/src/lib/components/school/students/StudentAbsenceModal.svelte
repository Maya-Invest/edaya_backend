<script lang="ts">
	import type { Student } from '$lib/types/school';
	import { recordStudentDailyAttendanceMutation } from '$lib/api/mutations/student.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Select from '$lib/components/ui/select';
	import { Plus } from '$lib/icons';

	const {
		s,
		disabled = false,
		title,
	}: {
		s: Student;
		disabled?: boolean;
		title?: string;
	} = $props();

	type AttendanceStatus = 'absent' | 'late';

	let open = $state(false);
	let busy = $state(false);
	let date = $state(new Date().toISOString().slice(0, 10));
	let status = $state<AttendanceStatus>('absent');

	const canSubmit = $derived(date.length > 0);

	function resetForm() {
		date = new Date().toISOString().slice(0, 10);
		status = 'absent';
	}

	async function submit() {
		if (!canSubmit)
			return;

		busy = true;
		const ok = await recordStudentDailyAttendanceMutation({
			studentId: s.id,
			classGroupId: s.classId,
			date,
			status,
			successMessage: `Présence mise à jour pour ${s.name}.`,
		});
		busy = false;
		if (ok) {
			open = false;
			resetForm();
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
	<Plus class="mr-1 h-4 w-4" /> Déclarer une absence
</Button>

<FormModal
	bind:open
	title={`Déclarer une absence pour ${s.name}`}
	description="La déclaration est enregistrée sur la journée sélectionnée."
	submitLabel="Enregistrer"
	busy={busy}
	submitDisabled={!canSubmit}
	onCancel={resetForm}
	onSubmit={submit}
>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Date</Label>
		<Input type="date" bind:value={date} />
	</div>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Statut</Label>
		<Select.Root type="single" value={status} onValueChange={v => v && (status = v as AttendanceStatus)}>
			<Select.Trigger>
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="absent">Absent</Select.Item>
				<Select.Item value="late">En retard</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>
</FormModal>
