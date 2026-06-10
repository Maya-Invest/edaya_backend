<script lang="ts">
	import { Mail, Phone, Plus, Search, Users } from 'lucide-svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils';
	import type { Guardian, StaffMember, Student } from '$lib/data/school';
	import { t } from '$lib/i18n';

	type PeopleTab = 'guardians' | 'staff';

	let {
		staff,
		guardians,
		students,
		onSelectGuardian,
		onSelectStaff,
		selectedId,
		forcedTab,
	}: {
		staff: StaffMember[];
		guardians: Guardian[];
		students: Student[];
		onSelectGuardian?: (g: Guardian) => void;
		onSelectStaff?: (s: StaffMember) => void;
		selectedId?: string;
		forcedTab?: PeopleTab;
	} = $props();

	const relationKey: Record<Guardian['relation'], string> = {
		Mother: 'guardian.relation.Mother',
		Father: 'guardian.relation.Father',
		'Legal guardian': 'guardian.relation.LegalGuardian',
	};

	let internalTab = $state<PeopleTab>('guardians');
	let q = $state('');

	const tab = $derived(forcedTab ?? internalTab);
	const filteredG = $derived(
		guardians.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))
	);
	const filteredS = $derived(staff.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())));
	const tabKeys: PeopleTab[] = ['guardians', 'staff'];
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('people.directory')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{tab === 'guardians'
					? $t('people.guardiansCount', { n: guardians.length })
					: $t('people.staffCount', { n: staff.length })}
			</h2>
		</div>
		<div class="flex items-center gap-2">
			{#if !forcedTab}
				<div class="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
					{#each tabKeys as k (k)}
						<button
							type="button"
							onclick={() => (internalTab = k)}
							class={cn(
								'rounded-full px-3.5 py-1.5 text-xs font-medium transition',
								tab === k
									? 'bg-primary text-primary-foreground shadow-soft'
									: 'text-muted-foreground hover:text-foreground'
							)}
						>
							{$t(`people.${k}`)}
						</button>
					{/each}
				</div>
			{/if}
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					bind:value={q}
					placeholder={$t('common.search')}
					class="h-9 w-56 rounded-full pl-9 text-sm"
				/>
			</div>
			<Button size="sm" class="rounded-full">
				<Plus class="mr-1 h-4 w-4" />
				{$t('common.add')}
			</Button>
		</div>
	</div>

	{#if tab === 'guardians'}
		<div class="grid gap-3 md:grid-cols-2">
			{#each filteredG as g (g.id)}
				{@const linked = g.studentIds
					.map((id) => students.find((s) => s.id === id))
					.filter(Boolean) as typeof students}
				{@const active = selectedId === g.id}
				<button
					type="button"
					onclick={() => onSelectGuardian?.(g)}
					class={cn(
						'group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel',
						active && 'ring-2 ring-accent'
					)}
				>
					<div
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-base font-semibold text-primary-foreground"
					>
						{g.initials}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center justify-between gap-2">
							<h3 class="truncate font-display text-base font-semibold">{g.name}</h3>
							<span
								class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
							>
								{$t(relationKey[g.relation])}
							</span>
						</div>
						<p class="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
							<Mail class="h-3 w-3" />
							{g.email}
						</p>
						<p class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
							<Phone class="h-3 w-3" />
							{g.phone}
						</p>
						<div class="mt-3 flex items-center gap-2 border-t border-border pt-3">
							<Users class="h-3 w-3 text-muted-foreground" />
							<div class="flex flex-wrap gap-1">
								{#each linked as s (s.id)}
									<span
										class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-accent-foreground"
									>
										{s.name}
									</span>
								{/each}
							</div>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
			<div
				class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
			>
				<div class="col-span-5">{$t('people.name')}</div>
				<div class="col-span-3">{$t('people.role')}</div>
				<div class="col-span-4">{$t('people.classes')}</div>
			</div>
			<ul>
				{#each filteredS as s (s.id)}
					{@const active = selectedId === s.id}
					<li>
						<button
							type="button"
							onclick={() => onSelectStaff?.(s)}
							class={cn(
								'grid w-full grid-cols-12 items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0',
								active ? 'bg-primary/10' : 'hover:bg-secondary'
							)}
						>
							<div class="col-span-5 flex items-center gap-3">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-display text-sm font-semibold text-primary-foreground"
								>
									{s.initials}
								</div>
								<div class="min-w-0">
									<p class="truncate text-sm font-medium">{s.name}</p>
									<p class="flex items-center gap-1 truncate text-xs text-muted-foreground">
										<Mail class="h-3 w-3" />
										{s.email}
									</p>
								</div>
							</div>
							<div class="col-span-3">
								<span
									class="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground/80"
								>
									{$t(`staff.role.${s.role}`)}
								</span>
							</div>
							<div class="col-span-4">
								{#if s.classes.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each s.classes as c (c)}
											<span
												class="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
											>
												{c}
											</span>
										{/each}
									</div>
								{:else}
									<span class="text-xs text-muted-foreground">—</span>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
