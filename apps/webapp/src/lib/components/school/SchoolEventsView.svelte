<script lang="ts">
	import { AlertTriangle, Plus, Search } from 'lucide-svelte';
	import type { ClassNode, Incident, Student } from '$lib/data/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import * as Select from '$lib/components/ui/select';
	import { cn } from '$lib/utils';
	import { locale, t } from '$lib/i18n';

	let {
		incidents,
		students,
		classes,
		classId,
		onSelect,
		selectedId,
	}: {
		incidents: Incident[];
		students: Student[];
		classes: ClassNode[];
		classId?: string;
		onSelect?: (i: Incident) => void;
		selectedId?: string;
	} = $props();

	const sevTone: Record<Incident['severity'], string> = {
		low: 'bg-secondary text-foreground/70',
		medium: 'bg-highlight-soft text-highlight',
		high: 'bg-destructive/10 text-destructive',
	};

	const catTone: Record<Incident['category'], string> = {
		Behavior: 'bg-highlight-soft text-highlight',
		Tardiness: 'bg-secondary text-foreground/70',
		Conflict: 'bg-destructive/10 text-destructive',
		Other: 'bg-secondary text-foreground/80',
	};

	let classFilter = $state('all');
	let searchQuery = $state('');

	$effect.pre(() => {
		if (classId) classFilter = classId;
	});

	const list = $derived.by(() => {
		let filtered = incidents;

		const effectiveClassId = classId || (classFilter !== 'all' ? classFilter : undefined);
		if (effectiveClassId) {
			const sIds = new Set(
				students.filter((s) => s.classId === effectiveClassId).map((s) => s.id)
			);
			filtered = filtered.filter((i) => sIds.has(i.studentId));
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			filtered = filtered.filter((i) => {
				const st = students.find((s) => s.id === i.studentId);
				return st?.name.toLowerCase().includes(q) ?? false;
			});
		}

		return filtered;
	});
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('events.schoolLife')}
			</p>
			<h2 class="font-display text-2xl font-semibold">{$t('events.count', { n: list.length })}</h2>
		</div>
		<Button size="sm" class="rounded-full">
			<Plus class="mr-1 h-4 w-4" />
			{$t('events.log')}
		</Button>
	</div>

	<div class="mb-4 flex flex-wrap items-center gap-3">
		{#if !classId}
			<Select.Root
				type="single"
				value={classFilter}
				onValueChange={(v) => v && (classFilter = v)}
			>
				<Select.Trigger class="h-9 w-[220px] rounded-lg text-sm">
					<Select.Value placeholder={$t('sidebar.pickClass')} />
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all">{$t('common.allClasses')}</Select.Item>
					{#each classes as c (c.id)}
						<Select.Item value={c.id}>{c.name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		{/if}
		<div class="relative min-w-[200px] max-w-sm flex-1">
			<Search
				class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				placeholder={$t('common.searchStudent')}
				bind:value={searchQuery}
				class="h-9 rounded-lg pl-9 text-sm"
			/>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-2">{$t('events.date')}</div>
			<div class="col-span-3">{$t('events.student')}</div>
			<div class="col-span-2">{$t('events.category')}</div>
			<div class="col-span-1">{$t('events.severity')}</div>
			<div class="col-span-4">{$t('events.summary')}</div>
		</div>
		<ul>
			{#each list as i (i.id)}
				{@const st = students.find((s) => s.id === i.studentId)}
				{@const cls = classes.find((c) => c.id === st?.classId)}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(i)}
						class={cn(
							'grid w-full grid-cols-12 gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary',
							selectedId === i.id && 'bg-secondary/60'
						)}
					>
						<div class="col-span-2 font-mono text-xs text-muted-foreground">
							{new Date(i.date).toLocaleDateString($locale, {
								day: 'numeric',
								month: 'short',
								year: 'numeric',
							})}
						</div>
						<div class="col-span-3 flex items-center gap-2">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-xs font-semibold text-primary-foreground"
							>
								{st?.initials}
							</div>
							<div>
								<p class="text-sm font-medium">{st?.name}</p>
								<p class="text-[10px] text-muted-foreground">{cls?.name}</p>
							</div>
						</div>
						<div class="col-span-2">
							<span
								class={cn(
									'rounded-full px-2 py-0.5 text-[10px] font-medium',
									catTone[i.category]
								)}
							>
								{$t(`events.cat.${i.category}`)}
							</span>
						</div>
						<div class="col-span-1">
							<span
								class={cn(
									'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
									sevTone[i.severity]
								)}
							>
								{$t(`events.severity.${i.severity}`)}
							</span>
						</div>
						<div class="col-span-4 flex items-center gap-2 text-sm text-foreground/80">
							<AlertTriangle class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							{i.summary}
						</div>
					</button>
				</li>
			{/each}
			{#if list.length === 0}
				<li class="px-5 py-12 text-center text-sm text-muted-foreground">{$t('events.none')}</li>
			{/if}
		</ul>
	</div>
</div>
