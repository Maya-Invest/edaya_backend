<script lang="ts">
	import { Mail, MoreHorizontal, Plus, Search } from 'lucide-svelte';
	import type { ClassNode, Student } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Select from '$lib/components/ui/select';
	import { t } from '$lib/i18n';

	let {
		students,
		classes,
		hierarchy,
		onSelect,
		selectedId,
	}: {
		students: Student[];
		classes: ClassNode[];
		hierarchy: { level: string; classes: ClassNode[] }[];
		onSelect?: (s: Student) => void;
		selectedId?: string;
	} = $props();

	const statusStyle: Record<Student['status'], string> = {
		honor: 'bg-secondary text-foreground/80',
		active: 'bg-secondary text-foreground/70',
		warning: 'bg-highlight-soft text-highlight',
	};

	let q = $state('');
	let classFilter = $state<string>('all');
	let status = $state<'all' | Student['status']>('all');

	const list = $derived(
		students.filter((s) => classFilter === 'all' || s.classId === classFilter)
			.filter((s) => status === 'all' || s.status === status)
			.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
	);

	const statusKeys = ['all', 'honor', 'active', 'warning'] as const;

	function statusLabel(k: (typeof statusKeys)[number]) {
		return k === 'all' ? $t('filter.all') : $t(`studentStatus.${k}`);
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('students.schoolRoster')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('students.countLabel', { n: list.length })}
			</h2>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					bind:value={q}
					placeholder={$t('common.searchStudent')}
					class="h-9 w-56 rounded-full pl-9 text-sm"
				/>
			</div>
			<Select.Root
				type="single"
				value={classFilter}
				onValueChange={(v) => v && (classFilter = v)}
			>
				<Select.Trigger class="h-9 w-48 rounded-full text-xs">
					<Select.Value placeholder={$t('common.allClasses')} />
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$t('common.allClasses')}</Select.Item>
					{#each hierarchy as g (g.level)}
						<Select.Group>
							<Select.Label>{g.level}</Select.Label>
							{#each g.classes as c (c.id)}
								<Select.Item value={c.id}>
									{c.name}
									<span class="ml-1 text-muted-foreground">· {c.studentCount}</span>
								</Select.Item>
							{/each}
						</Select.Group>
					{/each}
				</Select.Content>
			</Select.Root>
			<div class="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
				{#each statusKeys as k (k)}
					<button
						type="button"
						onclick={() => (status = k)}
						class={cn(
							'rounded-full px-3 py-1 text-[11px] font-medium transition',
							status === k
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						{statusLabel(k)}
					</button>
				{/each}
			</div>
			<Button size="sm" class="rounded-full">
				<Plus class="mr-1 h-4 w-4" />
				{$t('students.newStudent')}
			</Button>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-4">{$t('students.student')}</div>
			<div class="col-span-2">{$t('students.class')}</div>
			<div class="col-span-2">{$t('students.average')}</div>
			<div class="col-span-2">{$t('students.attendance')}</div>
			<div class="col-span-2">{$t('students.status')}</div>
		</div>
		<ul>
			{#each list as s (s.id)}
				{@const cls = classes.find((c) => c.id === s.classId)}
				{@const active = selectedId === s.id}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(s)}
						class={cn(
							'grid w-full grid-cols-12 items-center gap-4 border-b border-border px-5 py-3.5 text-left transition-colors last:border-b-0',
							active ? 'bg-primary/10' : 'hover:bg-secondary'
						)}
					>
						<div class="col-span-4 flex items-center gap-3">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-xs font-semibold text-primary-foreground"
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
						<div class="col-span-2 text-sm text-foreground/80">{cls?.name}</div>
						<div class="col-span-2 font-display text-base font-semibold tabular-nums">
							{s.average.toFixed(1)}
						</div>
						<div class="col-span-2">
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
								<div class="h-full rounded-full bg-accent" style:width="{s.attendance}%"></div>
							</div>
							<p class="mt-1 font-mono text-[10px] text-muted-foreground">{s.attendance}%</p>
						</div>
						<div class="col-span-2 flex items-center justify-between">
							<span
								class={cn(
									'rounded-full px-2 py-0.5 text-[10px] font-medium',
									statusStyle[s.status]
								)}
							>
								{$t(`studentStatus.${s.status}`)}
							</span>
							<MoreHorizontal class="h-4 w-4 text-muted-foreground" />
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
