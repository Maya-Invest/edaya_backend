<script lang="ts">
	import { academicContext } from '$lib/academic/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { t } from '$lib/i18n';
	import { Layers, Pencil, Plus, Trash2 } from '$lib/icons';
	import { toast } from '$lib/toast.svelte';
	import { get } from 'svelte/store';

	let showForm = $state(false);
	let editingId = $state<string | null>(null);
	let name = $state('');
	let gradeLevelId = $state(academicContext.gradeLevels[0]?.id ?? 'gl-6');
	let studentCount = $state('0');

	const sortedLevels = $derived([...academicContext.gradeLevels].sort((a, b) => a.order - b.order));

	function resetForm() {
		editingId = null;
		name = '';
		gradeLevelId = academicContext.gradeLevels[0]?.id ?? 'gl-6';
		studentCount = '0';
		showForm = false;
	}

	function startEdit(classId: string) {
		const entry = academicContext.classes.find(c => c.id === classId);
		if (!entry)
			return;
		editingId = classId;
		name = entry.name;
		gradeLevelId = entry.gradeLevelId;
		studentCount = String(entry.studentCount);
		showForm = true;
	}

	function handleSubmit() {
		if (!name.trim())
			return;
		if (editingId) {
			academicContext.updateClass(editingId, {
				name: name.trim(),
				gradeLevelId,
				studentCount: Number(studentCount) || 0,
			});
			toast.success(get(t)('classGroups.toastUpdated', { name: name.trim() }));
		}
		else {
			const created = academicContext.addClass(name.trim(), gradeLevelId);
			if (created) {
				academicContext.updateClass(created.id, { studentCount: Number(studentCount) || 0 });
				toast.success(get(t)('classGroups.toastCreated', { name: created.name }));
			}
		}
		resetForm();
	}

	function handleDelete(classId: string) {
		const removed = academicContext.removeClass(classId);
		if (removed)
			toast.success(get(t)('classGroups.toastDeleted', { name: removed.name }));
		if (editingId === classId)
			resetForm();
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('classGroups.subtitle')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('classGroups.title', { n: academicContext.classes.length })}
			</h2>
		</div>
		<Button
			class="rounded-full"
			onclick={() => {
				resetForm();
				showForm = true;
			}}
		>
			<Plus class="h-4 w-4" />
			{$t('classGroups.add')}
		</Button>
	</div>

	{#if showForm}
		<form
			class="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<p class="mb-4 font-display text-sm font-semibold">
				{editingId ? $t('classGroups.edit') : $t('classGroups.add')}
			</p>
			<div class="grid gap-4 sm:grid-cols-3">
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('classGroups.name')}</span>
					<Input bind:value={name} placeholder="6th — C" class="rounded-xl" required />
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('classGroups.gradeLevel')}</span>
					<select
						bind:value={gradeLevelId}
						class="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#each sortedLevels as level (level.id)}
							<option value={level.id}>{level.name} · {level.cycle}</option>
						{/each}
					</select>
				</label>
				<label class="space-y-1.5 text-sm">
					<span class="text-muted-foreground">{$t('classGroups.studentCount')}</span>
					<Input type="number" min="0" bind:value={studentCount} class="rounded-xl" />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<Button type="button" variant="outline" class="rounded-full" onclick={resetForm}>
					{$t('academic.cancel')}
				</Button>
				<Button type="submit" class="rounded-full">{$t('academic.save')}</Button>
			</div>
		</form>
	{/if}

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
												onclick={() => startEdit(cls.id)}
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
