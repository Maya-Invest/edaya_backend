<script lang="ts">
	import { Mail, Phone, Plus, Search, Users } from 'lucide-svelte';
	import type { Guardian, Student } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { t } from '$lib/i18n';

	let {
		guardians,
		students,
		onSelect,
		selectedId,
	}: {
		guardians: Guardian[];
		students: Student[];
		onSelect?: (g: Guardian) => void;
		selectedId?: string;
	} = $props();

	const relationKey: Record<Guardian['relation'], string> = {
		Mother: 'guardian.relation.Mother',
		Father: 'guardian.relation.Father',
		'Legal guardian': 'guardian.relation.LegalGuardian',
	};

	let q = $state('');

	const list = $derived(
		guardians.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))
	);
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('school.guardians')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('people.guardiansCount', { n: list.length })}
			</h2>
		</div>
		<div class="flex flex-wrap items-center gap-2">
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

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-4">{$t('people.name')}</div>
			<div class="col-span-2">{$t('guardian.relationLabel')}</div>
			<div class="col-span-3">{$t('common.phone')}</div>
			<div class="col-span-2">{$t('students.student')}</div>
			<div class="col-span-1 text-right">·</div>
		</div>
		<ul>
			{#each list as g (g.id)}
				{@const active = selectedId === g.id}
				{@const linked = g.studentIds
					.map((id) => students.find((s) => s.id === id))
					.filter(Boolean) as typeof students}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(g)}
						class={cn(
							'grid w-full grid-cols-12 items-center gap-4 border-b border-border px-5 py-3.5 text-left transition-colors last:border-b-0',
							active ? 'bg-primary/10' : 'hover:bg-secondary'
						)}
					>
						<div class="col-span-4 flex items-center gap-3">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-xs font-semibold text-primary-foreground"
							>
								{g.initials}
							</div>
							<div class="min-w-0">
								<p class="truncate text-sm font-medium">{g.name}</p>
								<p class="flex items-center gap-1 truncate text-xs text-muted-foreground">
									<Mail class="h-3 w-3" />
									{g.email}
								</p>
							</div>
						</div>
						<div class="col-span-2">
							<span
								class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
							>
								{$t(relationKey[g.relation])}
							</span>
						</div>
						<div class="col-span-3">
							<p class="flex items-center gap-1 text-xs text-muted-foreground">
								<Phone class="h-3 w-3" />
								{g.phone}
							</p>
						</div>
						<div class="col-span-2">
							{#if linked.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each linked as s (s.id)}
										<span
											class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-accent-foreground"
										>
											{s.name}
										</span>
									{/each}
								</div>
							{:else}
								<span class="text-xs text-muted-foreground">—</span>
							{/if}
						</div>
						<div class="col-span-1 flex justify-end">
							<Users class="h-4 w-4 text-muted-foreground" />
						</div>
					</button>
				</li>
			{/each}
			{#if list.length === 0}
				<li class="px-5 py-12 text-center text-sm text-muted-foreground">
					{$t('students.noMatch')}
				</li>
			{/if}
		</ul>
	</div>
</div>
