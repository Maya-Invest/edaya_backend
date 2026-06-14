<script lang="ts">
	import type { PedagogicalNote, Student } from '$lib/types/school';
	import {
		createStudentNoteMutation,
		updateStudentNoteMutation,
	} from '$lib/api/mutations/student.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import FormModal from '$lib/components/ui/FormModal.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Select from '$lib/components/ui/select';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import { Plus } from '$lib/icons';

	const {
		s,
		note,
		disabled = false,
		title,
	}: {
		s: Student;
		note?: PedagogicalNote;
		disabled?: boolean;
		title?: string;
	} = $props();

	type Category = 'behavior' | 'work' | 'progress' | 'encouragement';
	const uiToApiCategory: Record<PedagogicalNote['category'], Category> = {
		Comportement: 'behavior',
		Travail: 'work',
		Progression: 'progress',
		Encouragement: 'encouragement',
	};

	let open = $state(false);
	let busy = $state(false);
	let category = $state<Category>('work');
	let body = $state('');

	const canSubmit = $derived(body.trim().length > 0);

	function resetForm() {
		category = note ? uiToApiCategory[note.category] : 'work';
		body = note?.content ?? '';
	}

	$effect(() => {
		resetForm();
	});

	async function submit() {
		if (!canSubmit)
			return;

		busy = true;
		const ok = note
			? await updateStudentNoteMutation({
				noteId: note.id,
				category,
				body,
				successMessage: `Note mise à jour pour ${s.name}.`,
			})
			: await createStudentNoteMutation({
				studentId: s.id,
				category,
				body,
				successMessage: `Note ajoutée pour ${s.name}.`,
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
	class={note ? 'h-7 rounded-full px-2 text-[11px]' : 'w-full rounded-full border border-dashed border-border'}
	{disabled}
	{title}
	onclick={() => (open = true)}
>
	{#if note}
		Modifier
	{:else}
		<Plus class="mr-1 h-4 w-4" /> Ajouter une note
	{/if}
</Button>

<FormModal
	bind:open
	title={note ? `Modifier la note de ${s.name}` : `Ajouter une note pour ${s.name}`}
	description="La note sera visible dans le dossier pédagogique de l’élève."
	submitLabel={note ? 'Enregistrer' : 'Ajouter'}
	busy={busy}
	submitDisabled={!canSubmit}
	onCancel={resetForm}
	onSubmit={submit}
>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Catégorie</Label>
		<Select.Root type="single" value={category} onValueChange={v => v && (category = v as Category)}>
			<Select.Trigger>
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="work">Travail</Select.Item>
				<Select.Item value="behavior">Comportement</Select.Item>
				<Select.Item value="progress">Progression</Select.Item>
				<Select.Item value="encouragement">Encouragement</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>
	<div class="space-y-1.5">
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Note</Label>
		<Textarea bind:value={body} rows={5} />
	</div>
</FormModal>
