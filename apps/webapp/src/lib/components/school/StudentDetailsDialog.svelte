<script lang="ts">
	import type { Student } from '$lib/data/school';
	import { academicContext } from '$lib/academic/context.svelte';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Info } from '$lib/icons';

	const { s }: { s: Student } = $props();

	const cls = $derived(academicContext.classes.find(c => c.id === s.classId));
	const linkedG = $derived(detailDataContext.guardians.filter(g => g.studentIds.includes(s.id)));
	const health = $derived(detailDataContext.healthRecords[s.id]);
	const studentIncidents = $derived(detailDataContext.incidents.filter(i => i.studentId === s.id));
</script>

<Dialog.Root>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="mr-auto rounded-full">
				<Info class="mr-1 h-4 w-4" /> Détails
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="font-display text-2xl">{s.name}</Dialog.Title>
			<Dialog.Description>
				{cls?.name} · Moyenne {s.average.toFixed(1)}/20 · {s.attendance}% de présence
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 text-sm">
			<section>
				<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identité</h4>
				<div class="grid grid-cols-2 gap-2 rounded-xl bg-secondary/40 p-3 text-xs">
					<div><span class="text-muted-foreground">E-mail :</span> {s.email}</div>
					<div><span class="text-muted-foreground">Né(e) le :</span> {s.birthdate}</div>
					<div><span class="text-muted-foreground">Statut :</span> {s.status}</div>
					<div><span class="text-muted-foreground">Tuteur :</span> {s.guardian}</div>
				</div>
			</section>
			<section>
				<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
					Tuteurs ({linkedG.length})
				</h4>
				<div class="space-y-2">
					{#if linkedG.length}
						{#each linkedG as g (g.id)}
							<div
								class="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
							>
								<span class="font-medium">{g.name}</span>
								<span class="text-muted-foreground">{g.email} · {g.phone}</span>
							</div>
						{/each}
					{:else}
						<p class="text-xs text-muted-foreground">Aucun tuteur rattaché.</p>
					{/if}
				</div>
			</section>
			<section>
				<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Santé</h4>
				{#if health}
					<div class="space-y-1 rounded-xl bg-primary/5 p-3 text-xs">
						<div><span class="text-muted-foreground">Groupe sanguin :</span> {health.bloodType}</div>
						<div>
							<span class="text-muted-foreground">Allergies :</span>
							{health.allergies.join(', ') || 'Aucune'}
						</div>
						<div>
							<span class="text-muted-foreground">Maladies chroniques :</span>
							{health.chronicConditions.join(', ') || 'Aucune'}
						</div>
						<div>
							<span class="text-muted-foreground">Traitements :</span>
							{health.medications.join(', ') || 'Aucun'}
						</div>
						<div><span class="text-muted-foreground">Dernière visite :</span> {health.lastVisit}</div>
						{#if health.notes}
							<div class="mt-1 italic text-muted-foreground">"{health.notes}"</div>
						{/if}
					</div>
				{:else}
					<p class="text-xs text-muted-foreground">Aucun dossier de santé.</p>
				{/if}
			</section>
			<section>
				<h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
					Incidents ({studentIncidents.length})
				</h4>
				{#if studentIncidents.length}
					<ul class="space-y-1.5">
						{#each studentIncidents as i (i.id)}
							<li class="rounded-lg border border-border px-3 py-2 text-xs">
								<span class="font-medium">{i.category}</span> ·
								<span class="text-muted-foreground">{i.date}</span>
								<p class="mt-0.5 text-muted-foreground">{i.summary}</p>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-xs text-muted-foreground">Aucun incident.</p>
				{/if}
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
