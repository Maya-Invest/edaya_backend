<script lang="ts">
	import type { Student } from '$lib/types/school';
	import { academicContext } from '$lib/academic/context.svelte';
	import { transferStudentMutation } from '$lib/api/mutations/student.mutations';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import Label from '$lib/components/ui/label/label.svelte';
	import * as Select from '$lib/components/ui/select';
	import { Users } from '$lib/icons';
	import { toast } from '$lib/toast.svelte';

	const { s }: { s: Student } = $props();

	let open = $state(false);
	let target = $derived(s.classId);
	let busy = $state(false);

	const currentClass = $derived(academicContext.classes.find(c => c.id === s.classId));
	const targetClass = $derived(academicContext.classes.find(c => c.id === target));

	async function confirmTransfer() {
		if (target === s.classId || !s.enrollmentId) {
			if (!s.enrollmentId) {
				toast.error('Inscription active introuvable pour cet élève.');
			}
			return;
		}

		busy = true;
		const ok = await transferStudentMutation({
			enrollmentId: s.enrollmentId,
			studentId: s.id,
			nextClassGroupId: target,
		});
		busy = false;
		if (ok) {
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="gap-2 rounded-full">
				<Users class="h-3.5 w-3.5" />
				Changer de classe
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Changer la classe de {s.name}</Dialog.Title>
			<Dialog.Description>
				Classe actuelle : {currentClass?.name ?? '—'} · {currentClass?.level ?? ''}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-2 py-2">
			<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
				Nouvelle classe
			</Label>
			<Select.Root type="single" value={target} onValueChange={v => v && (target = v)}>
				<Select.Trigger>
					<Select.Value />
				</Select.Trigger>
				<Select.Content>
					{#each academicContext.classes as c (c.id)}
						<Select.Item value={c.id}>
							{c.name}
							<span class="ml-1 text-muted-foreground">· {c.level}</span>
						</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			{#if targetClass && target !== s.classId}
				<p class="text-xs text-muted-foreground">
					{s.name} sera transféré(e) vers {targetClass.name}.
				</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (open = false)} disabled={busy}>Annuler</Button>
			<Button
				onclick={confirmTransfer}
				disabled={busy || target === s.classId || !s.enrollmentId}
			>
				Confirmer
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
