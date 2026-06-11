<script lang="ts">
	import type { Student } from '$lib/data/school';
	import { Camera } from '$lib/icons';

	const { s }: { s: Student } = $props();

	let photo = $state<string | null>(null);
	const inputId = $derived(`student-photo-${s.id}`);

	function handleFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file)
			return;
		const reader = new FileReader();
		reader.onload = () => {
			photo = typeof reader.result === 'string' ? reader.result : null;
		};
		reader.readAsDataURL(file);
	}
</script>

<div class="group relative h-14 w-14 shrink-0">
	<label
		for={inputId}
		class="flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-primary font-display text-lg font-semibold text-primary-foreground shadow-soft"
		title="Changer la photo"
	>
		{#if photo}
			<img src={photo} alt={s.name} class="h-full w-full object-cover" />
		{:else}
			<span>{s.initials}</span>
		{/if}
		<span
			class="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/60 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
		>
			<Camera class="h-4 w-4" />
		</span>
	</label>
	<input id={inputId} type="file" accept="image/*" class="hidden" onchange={handleFile} />
</div>
