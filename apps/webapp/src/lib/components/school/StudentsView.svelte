<script lang="ts">
	import { Mail, MoreHorizontal, Plus } from 'lucide-svelte';
	import type { Student } from '$lib/data/school';
	import { cn } from '$lib/utils';
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';

	let {
		students,
		onSelect,
		selectedId,
		className: _className,
		classLevel: _classLevel,
	}: {
		students: Student[];
		onSelect?: (s: Student) => void;
		selectedId?: string;
		className?: string;
		classLevel?: string;
	} = $props();

	const statusStyle: Record<Student['status'], string> = {
		honor: 'bg-secondary text-foreground/80',
		active: 'bg-secondary text-foreground/70',
		warning: 'bg-highlight-soft text-highlight',
	};

	function statusLabel(st: Student['status']) {
		return st === 'honor'
			? $t('studentStatus.honorLong')
			: st === 'warning'
				? $t('studentStatus.warningLong')
				: $t('studentStatus.active');
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex items-center justify-between">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('students.roster')}
			</p>
			<h2 class="font-display text-2xl font-semibold">
				{$t('students.enrolled', { n: students.length })}
			</h2>
		</div>
		<div class="flex items-center gap-2">
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
			<div class="col-span-5">{$t('students.student')}</div>
			<div class="col-span-2">{$t('students.average')}</div>
			<div class="col-span-2">{$t('students.attendance')}</div>
			<div class="col-span-2">{$t('students.status')}</div>
			<div class="col-span-1 text-right">·</div>
		</div>
		<ul>
			{#each students as s (s.id)}
				{@const active = selectedId === s.id}
				<li>
					<button
						type="button"
						onclick={() => onSelect?.(s)}
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
						<div class="col-span-2">
							<p class="font-display text-lg font-semibold tabular-nums">{s.average.toFixed(1)}</p>
							<p class="text-[11px] text-muted-foreground">/ 20</p>
						</div>
						<div class="col-span-2">
							<div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
								<div class="h-full rounded-full bg-accent" style:width="{s.attendance}%"></div>
							</div>
							<p class="mt-1 text-[11px] font-mono text-muted-foreground">{s.attendance}%</p>
						</div>
						<div class="col-span-2">
							<span
								class={cn(
									'rounded-full px-2.5 py-1 text-[11px] font-medium',
									statusStyle[s.status]
								)}
							>
								{statusLabel(s.status)}
							</span>
						</div>
						<div class="col-span-1 flex justify-end">
							<MoreHorizontal class="h-4 w-4 text-muted-foreground" />
						</div>
					</button>
				</li>
			{/each}
			{#if students.length === 0}
				<li class="px-5 py-12 text-center text-sm text-muted-foreground">
					{$t('students.noneInClass')}
				</li>
			{/if}
		</ul>
	</div>
</div>
