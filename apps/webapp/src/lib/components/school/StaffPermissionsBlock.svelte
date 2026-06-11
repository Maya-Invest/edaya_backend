<script lang="ts">
	import type { StaffRole } from '$lib/data/school';
	import { page } from '$app/stores';
	import Label from '$lib/components/ui/label/label.svelte';
	import { classes, subjects } from '$lib/data/school';
	import { ShieldCheck } from '$lib/icons';
	import { ROLE_LABEL_FR } from '$lib/permissions';
	import { cn } from '$lib/utils';
	import {
		STAFF_PERMISSIONS,
		STAFF_SCOPE_LABEL,
		STAFF_SCOPE_TONE,
		defaultEnabledFor,
	} from './drawer-constants';
	import ScopeChipSelector from './ScopeChipSelector.svelte';

	const { role }: { role: StaffRole } = $props();

	const classItems = $derived(classes.map(c => ({ id: c.id, label: c.name, hint: c.level })));

	const subjectItems = $derived.by(() => {
		const map: Record<string, { id: string; label: string }> = {};
		subjects.forEach((s) => {
			if (!map[s.name])
				map[s.name] = { id: s.name, label: s.name };
		});
		return Object.values(map);
	});

	const enabledMap = $derived.by(() => {
		const live = ($page.data.roleEnabledPermissions as Partial<Record<StaffRole, Record<string, boolean>>> | undefined)?.[role];
		return live ?? defaultEnabledFor(role);
	});

	const grouped = $derived.by(() => {
		const acc: Record<string, typeof STAFF_PERMISSIONS> = {};
		STAFF_PERMISSIONS.filter(p => enabledMap[p.key]).forEach((p) => {
			(acc[p.category] ||= []).push(p);
		});
		return acc;
	});

	let classSel = $state<Record<string, string[]>>(
		Object.fromEntries(STAFF_PERMISSIONS.map(p => [p.key, classes.map(c => c.id)])),
	);
	let subjectSel = $state<Record<string, string[]>>(
		Object.fromEntries(STAFF_PERMISSIONS.map(p => [p.key, subjectItems.map(s => s.id)])),
	);
</script>

<div class="space-y-3">
	<div class="flex items-center gap-2">
		<ShieldCheck class="h-4 w-4 text-muted-foreground" />
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
			Permissions du rôle · {ROLE_LABEL_FR[role]}
		</Label>
	</div>
	<p class="text-[11px] text-muted-foreground">
		Les permissions sont définies par le rôle. Ajustez ici uniquement la portée (classes / matières) quand cela
		s'applique.
	</p>
	{#each Object.entries(grouped) as [cat, rows] (cat)}
		<div class="overflow-hidden rounded-xl border border-border bg-card">
			<div
				class="bg-secondary/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
			>
				{cat}
			</div>
			<ul class="divide-y divide-border/60">
				{#each rows as p (p.key)}
					<li class="px-3 py-2.5">
						<div class="text-sm font-medium">{p.label}</div>
						<div class="text-xs text-muted-foreground">{p.description}</div>
						<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
							<span class="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
								Portée
							</span>
							{#each p.scopes as s (s)}
								{#if s === 'global'}
									<span
										class={cn(
											'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
											STAFF_SCOPE_TONE[s],
										)}
									>
										{STAFF_SCOPE_LABEL[s]}
									</span>
								{:else if s === 'class'}
									<ScopeChipSelector
										type="class"
										items={classItems}
										selected={classSel[p.key]}
										onChange={next => (classSel = { ...classSel, [p.key]: next })}
									/>
								{:else}
									<ScopeChipSelector
										type="subject"
										items={subjectItems}
										selected={subjectSel[p.key]}
										onChange={next => (subjectSel = { ...subjectSel, [p.key]: next })}
									/>
								{/if}
							{/each}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>
