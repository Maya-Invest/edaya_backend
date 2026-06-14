<script lang="ts">
	import type { Student } from '$lib/types/school';
	import { academicContext } from '$lib/academic/context.svelte';
	import { recordStudentIncidentMutation } from '$lib/api/mutations/student.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Select from '$lib/components/ui/select';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';

	const {
		s,
		disabled = false,
		title,
	}: {
		s: Student;
		disabled?: boolean;
		title?: string;
	} = $props();

	type IncidentKind = 'positive' | 'minor_infraction' | 'major_infraction' | 'emergency';

	let open = $state(false);
	let busy = $state(false);
	let incidentTitle = $state('');
	let description = $state('');
	let kind = $state<IncidentKind>('minor_infraction');

	const studentClass = $derived(academicContext.classes.find(entry => entry.id === s.classId));
	const schoolId = $derived(studentClass?.schoolId ?? academicContext.schools[0]?.id ?? '');
	const canSubmit = $derived(
		schoolId.length > 0 && incidentTitle.trim().length > 0 && description.trim().length > 0,
	);

	function resetForm() {
		incidentTitle = '';
		description = '';
		kind = 'minor_infraction';
	}

	async function submit() {
		if (!canSubmit)
			return;

		busy = true;
		const ok = await recordStudentIncidentMutation({
			schoolId,
			studentId: s.id,
			classGroupId: s.classId,
			title: incidentTitle,
			description,
			kind,
			successMessage: `Incident enregistré pour ${s.name}.`,
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
	Consigner un incident
</Button>

<FormModal
	bind:open
	title={`Consigner un incident pour ${s.name}`}
	description="L’incident sera rattaché au dossier de l’élève."
	submitLabel="Enregistrer"
	busy={busy}
	submitDisabled={!canSubmit}
	onCancel={resetForm}
	onSubmit={submit}
>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Titre</Label>
		<Input bind:value={incidentTitle} />
	</div>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Type</Label>
		<Select.Root type="single" value={kind} onValueChange={v => v && (kind = v as IncidentKind)}>
			<Select.Trigger>
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="positive">Positif</Select.Item>
				<Select.Item value="minor_infraction">Infraction mineure</Select.Item>
				<Select.Item value="major_infraction">Infraction majeure</Select.Item>
				<Select.Item value="emergency">Urgence</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Description</Label>
		<Textarea bind:value={description} rows={5} />
	</div>
</FormModal>
