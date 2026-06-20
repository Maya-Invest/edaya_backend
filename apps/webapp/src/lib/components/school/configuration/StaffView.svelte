<script lang="ts">
	import type { StaffMember } from '$lib/types/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import ListPageHeader from '$lib/components/ui/ListPageHeader.svelte';
	import PermissionGate from '$lib/components/ui/PermissionGate.svelte';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { Mail, Plus, Search } from '$lib/icons';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { cn } from '$lib/utils';
	import StaffCreateModal from './StaffCreateModal.svelte';

	const {
		onSelect,
		selectedId,
	}: {
		onSelect?: (s: StaffMember) => void;
		selectedId?: string;
	} = $props();

	const staff = $derived(detailDataContext.staff);

	let q = $state('');
	let createOpen = $state(false);

	const list = $derived(staff.filter(s => s.name.toLowerCase().includes(q.toLowerCase())));

	function handleCreated(staffId: string) {
		appGoto(detailHref.configStaffMember(staffId));
	}
</script>

<div class="animate-fade-in">
	<ListPageHeader
		eyebrow={$t('config.staffDirectory')}
		title={$t('people.staffCount', { n: list.length })}
	>
		{#snippet search()}
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
		{/snippet}
		{#snippet primary()}
			<PermissionGate
				permission="STAFF_CREATE"
				mode="disable"
				tooltip={$t('staff.permissionCreate')}
			>
				{#snippet children({ disabled, title })}
					<Button
						size="sm"
						class="rounded-full"
						{disabled}
						{title}
						onclick={() => (createOpen = true)}
					>
						<Plus class="mr-1 h-4 w-4" />
						{$t('staff.addStaff')}
					</Button>
				{/snippet}
			</PermissionGate>
		{/snippet}
	</ListPageHeader>

	<StaffCreateModal bind:open={createOpen} onCreated={handleCreated} />

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-5">{$t('people.name')}</div>
			<div class="col-span-3">{$t('people.role')}</div>
			<div class="col-span-4">{$t('people.classes')}</div>
		</div>
		<ul>
			{#each list as s (s.id)}
				{@const active = selectedId === s.id}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(s)}
						class={cn(
							'grid w-full grid-cols-12 items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0',
							active ? 'bg-primary/10' : 'hover:bg-secondary',
							!s.isActive && 'opacity-60',
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
			{#if list.length === 0}
				<li class="px-5 py-12 text-center text-sm text-muted-foreground">
					{$t('students.noMatch')}
				</li>
			{/if}
		</ul>
	</div>
</div>
