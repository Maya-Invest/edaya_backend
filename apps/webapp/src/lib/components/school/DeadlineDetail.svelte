<script lang="ts">
	import type { Deadline } from '$lib/data/school';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { students } from '$lib/data/school';
	import { locale, t } from '$lib/i18n';
	import { Check, Clock, AlertCircle, FileText, Paperclip } from '$lib/icons';
	import { cn } from '$lib/utils';
	import DrawerField from './DrawerField.svelte';

	const { d }: { d: Deadline } = $props();

	const subStatusStyle = {
		submitted: { icon: Check, cls: 'text-accent' },
		late: { icon: Clock, cls: 'text-highlight' },
		missing: { icon: AlertCircle, cls: 'text-muted-foreground' },
	} as const;
</script>

<div class="space-y-5">
	<div>
		<span
			class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			{$t(`deadlineType.${d.type}`)}
		</span>
		<p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{d.subject}</p>
		<h3 class="mt-1 font-display text-2xl font-semibold leading-tight">{d.title}</h3>
		<p class="mt-2 text-sm text-foreground/70">{d.description}</p>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<DrawerField label={$t('drawer.assigned')}>
			<Input type="date" value={d.assignedDate} />
		</DrawerField>
		<DrawerField label={$t('hw.due')}>
			<Input type="date" value={d.dueDate} />
		</DrawerField>
	</div>

	<div>
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
			{$t('drawer.attachments')}
		</Label>
		<div class="mt-2 space-y-2">
			{#each d.attachments as a (a.name)}
				<div class="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-card">
						<FileText class="h-4 w-4 text-muted-foreground" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm">{a.name}</p>
						<p class="font-mono text-[10px] text-muted-foreground">{a.size}</p>
					</div>
				</div>
			{/each}
			<Button variant="ghost" size="sm" class="w-full rounded-full border border-dashed border-border">
				<Paperclip class="mr-1 h-3 w-3" />
				{$t('drawer.attachFile')}
			</Button>
		</div>
	</div>

	<div>
		<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
			{$t('drawer.submissions')}
		</Label>
		<div class="mt-2 overflow-hidden rounded-xl border border-border">
			{#each d.submissions as sub, i (sub.studentId)}
				{@const st = students.find(s => s.id === sub.studentId)}
				{#if st}
					{@const meta = subStatusStyle[sub.status]}
					<div class={cn('flex items-center gap-3 px-3 py-2.5', i % 2 && 'bg-secondary/30')}>
						<div
							class="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-[10px] font-semibold text-primary-foreground"
						>
							{st.initials}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-medium">{st.name}</p>
							{#if sub.date}
								<p class="font-mono text-[10px] text-muted-foreground">
									{new Date(sub.date).toLocaleDateString($locale, { day: 'numeric', month: 'short' })}
								</p>
							{/if}
						</div>
						<meta.icon class={cn('h-4 w-4', meta.cls)} />
						<span class={cn('font-mono text-[10px] uppercase', meta.cls)}>
							{$t(`submission.${sub.status}`)}
						</span>
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>
