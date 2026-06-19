<script lang="ts">
	import type { ClassNode } from '$lib/types/school';
	import { academicContext } from '$lib/academic/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import { t } from '$lib/i18n';
	import { Layers, Pencil, Plus, Trash2 } from '$lib/icons';
	import { toast } from '$lib/toast.svelte';
	import { get } from 'svelte/store';
	import ClassGroupFormModal from './ClassGroupFormModal.svelte';

	let createOpen = $state(false);
	let editingClass = $state<ClassNode | undefined>(undefined);

	function openCreate() {
		editingClass = undefined;
		createOpen = true;
	}

	function openEdit(classId: string) {
		editingClass = academicContext.classes.find(entry => entry.id === classId);
		createOpen = true;
	}

	function handleDelete(_classId: string) {
		toast.error(get(t)('classGroups.deleteUnsupported'));
	}
</script>

<div class="animate-fade-in">
	<ListPageHeader
		eyebrow={$t('classGroups.subtitle')}
		title={$t('classGroups.title', { n: academicContext.classes.length })}
	>
		{#snippet primary()}
			<Button size="sm" class="rounded-full" onclick={openCreate}>
				<Plus class="mr-1 h-4 w-4" />
				{$t('classGroups.add')}
			</Button>
		{/snippet}
	</ListPageHeader>

	<div class="space-y-6">
		{#each academicContext.hierarchy as group (group.level)}
			<section>
				<h3 class="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
					<Layers class="h-4 w-4 text-muted-foreground" />
					{group.level}
				</h3>
				<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
					<table class="w-full text-sm">
						<thead class="border-b border-border bg-secondary/30 text-left">
							<tr>
								<th class="px-4 py-3 font-medium">{$t('classGroups.name')}</th>
								<th class="px-4 py-3 font-medium">{$t('classGroups.gradeLevel')}</th>
								<th class="px-4 py-3 font-medium">{$t('classGroups.studentCount')}</th>
								<th class="px-4 py-3 text-right font-medium">{$t('classGroups.actions')}</th>
							</tr>
						</thead>
						<tbody>
							{#each group.classes as cls (cls.id)}
								{@const level = academicContext.gradeLevelById(cls.gradeLevelId)}
								<tr class="border-b border-border/60 last:border-0">
									<td class="px-4 py-3">
										<p class="font-medium">{cls.name}</p>
										<p class="font-mono text-[10px] text-muted-foreground">{cls.id}</p>
									</td>
									<td class="px-4 py-3 text-muted-foreground">{level?.name ?? '—'}</td>
									<td class="px-4 py-3 font-mono">{cls.studentCount}</td>
									<td class="px-4 py-3">
										<div class="flex justify-end gap-1">
											<button
												type="button"
												class="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
												title={$t('classGroups.edit')}
												onclick={() => openEdit(cls.id)}
											>
												<Pencil class="h-3.5 w-3.5" />
											</button>
											<button
												type="button"
												class="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
												title={$t('classGroups.delete')}
												onclick={() => handleDelete(cls.id)}
											>
												<Trash2 class="h-3.5 w-3.5" />
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/each}
	</div>
</div>

<ClassGroupFormModal bind:open={createOpen} classGroup={editingClass} />
