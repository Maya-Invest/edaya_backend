<script lang="ts">
	import {
		ShieldCheck,
		Search,
		Crown,
		GraduationCap,
		HeartHandshake,
		ChevronRight,
		Users,
	} from 'lucide-svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { cn } from '$lib/utils';
	import type { StaffMember, StaffRole } from '$lib/data/school';
	import { ROLE_LABEL_FR, getCurrentUser } from '$lib/permissions';

	let {
		staff,
		onSelect,
		selectedRole,
	}: {
		staff: StaffMember[];
		onSelect?: (role: StaffRole) => void;
		selectedRole?: StaffRole;
	} = $props();

	const ROLES: {
		key: StaffRole;
		tint: string;
		desc: string;
	}[] = [
		{
			key: 'directeur',
			tint: 'bg-primary/10 text-primary',
			desc: "Accès total en lecture/écriture sur tout l'établissement.",
		},
		{
			key: 'prof_principal',
			tint: 'bg-primary/10 text-primary',
			desc: 'Dossiers, bulletins et orientation de sa classe attitrée.',
		},
		{
			key: 'professeur',
			tint: 'bg-secondary text-foreground/80',
			desc: 'Saisie des notes et absences pour ses matières et classes.',
		},
		{
			key: 'educateur',
			tint: 'bg-secondary text-foreground/80',
			desc: 'Vie scolaire pour tous ; notes en lecture seule.',
		},
	];

	const me = getCurrentUser();
	let q = $state('');

	const list = $derived.by(() => {
		const term = q.trim().toLowerCase();
		if (!term) return ROLES;
		return ROLES.filter(
			(r) =>
				ROLE_LABEL_FR[r.key].toLowerCase().includes(term) ||
				r.desc.toLowerCase().includes(term)
		);
	});

	function countByRole(r: StaffRole) {
		return staff.filter((s) => s.role === r).length;
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				RBAC · Rôles & permissions
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{list.length} rôle{list.length > 1 ? 's' : ''}
			</h2>
		</div>
		<div class="flex items-center gap-2">
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					bind:value={q}
					placeholder="Rechercher un rôle…"
					class="h-9 w-56 rounded-full pl-9 text-sm"
				/>
			</div>
			<div
				class="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground shadow-soft"
			>
				<span
					class="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
				>
					{me.initials}
				</span>
				<span class="font-mono uppercase tracking-wider">{ROLE_LABEL_FR[me.role]}</span>
			</div>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-5">Rôle</div>
			<div class="col-span-5">Description</div>
			<div class="col-span-1 text-center">Membres</div>
			<div class="col-span-1"></div>
		</div>
		<ul>
			{#each list as r (r.key)}
				{@const active = selectedRole === r.key}
				{@const count = countByRole(r.key)}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(r.key)}
						class={cn(
							'grid w-full grid-cols-12 items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0',
							active ? 'bg-primary/10' : 'hover:bg-secondary'
						)}
					>
						<div class="col-span-5 flex items-center gap-3">
							<span
								class={cn(
									'flex h-10 w-10 items-center justify-center rounded-xl',
									r.tint
								)}
							>
								{#if r.key === 'directeur'}
									<Crown class="h-4 w-4" />
								{:else if r.key === 'prof_principal'}
									<ShieldCheck class="h-4 w-4" />
								{:else if r.key === 'professeur'}
									<GraduationCap class="h-4 w-4" />
								{:else}
									<HeartHandshake class="h-4 w-4" />
								{/if}
							</span>
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold">{ROLE_LABEL_FR[r.key]}</p>
								<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
									{r.key}
								</p>
							</div>
						</div>
						<div class="col-span-5 text-sm text-muted-foreground">{r.desc}</div>
						<div class="col-span-1 text-center">
							<span
								class="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
							>
								<Users class="h-3 w-3" />
								{count}
							</span>
						</div>
						<div class="col-span-1 flex justify-end">
							<ChevronRight class="h-4 w-4 text-muted-foreground" />
						</div>
					</button>
				</li>
			{/each}
			{#if list.length === 0}
				<li class="px-5 py-12 text-center text-sm text-muted-foreground">
					Aucun rôle ne correspond.
				</li>
			{/if}
		</ul>
	</div>
</div>
