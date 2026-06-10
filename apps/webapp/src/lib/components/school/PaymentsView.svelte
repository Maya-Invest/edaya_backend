<script lang="ts">
	import { Check, Clock, Search } from 'lucide-svelte';
	import type { ClassNode, Fee, Student, StudentBilling } from '$lib/data/school';
	import Input from '$lib/components/ui/input/input.svelte';
	import { cn } from '$lib/utils';
	import { locale, t } from '$lib/i18n';

	let {
		billing,
		students,
		fees,
		classes
	}: {
		billing: StudentBilling[];
		students: Student[];
		fees: Fee[];
		classes: ClassNode[];
	} = $props();

	type PaymentRow = {
		id: string;
		studentId: string;
		feeId: string;
		date: string;
		amount: number;
		status: 'paid' | 'pending';
	};

	const rows: PaymentRow[] = $derived.by(() => {
		const out: PaymentRow[] = [];
		billing.forEach((b) => {
			b.installments.forEach((i, idx) =>
				out.push({
					id: `${b.id}-${idx}`,
					studentId: b.studentId,
					feeId: b.feeId,
					date: i.date,
					amount: i.amount,
					status: i.status,
				})
			);
		});
		return out.sort((a, b) => b.date.localeCompare(a.date));
	});

	let q = $state('');
	let status = $state<'all' | 'paid' | 'pending'>('all');
	let classFilter = $state('all');

	const list = $derived(
		rows.filter((r) => {
			if (status !== 'all' && r.status !== status) return false;
			const st = students.find((s) => s.id === r.studentId);
			if (!st) return false;
			if (classFilter !== 'all' && st.classId !== classFilter) return false;
			if (q && !st.name.toLowerCase().includes(q.toLowerCase())) return false;
			return true;
		})
	);

	const collected = $derived(
		list.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
	);
	const pending = $derived(
		list.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
	);

	const statusKeys = ['all', 'paid', 'pending'] as const;

	function statusLabel(k: (typeof statusKeys)[number]) {
		return k === 'all'
			? $t('filter.all')
			: k === 'paid'
				? $t('installment.paid')
				: $t('installment.pending');
	}
</script>

<div class="animate-fade-in space-y-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('finance.treasury')}
			</p>
			<h2 class="font-display text-2xl font-semibold">{$t('finance.payments')}</h2>
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
			<select
				bind:value={classFilter}
				class="h-9 rounded-full border border-border bg-card px-3 text-xs"
			>
				<option value="all">{$t('common.allClasses')}</option>
				{#each classes as c (c.id)}
					<option value={c.id}>{c.name}</option>
				{/each}
			</select>
			<div class="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
				{#each statusKeys as k (k)}
					<button
						type="button"
						onclick={() => (status = k)}
						class={cn(
							'rounded-full px-3 py-1 text-[11px] font-medium',
							status === k
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						{statusLabel(k)}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<div class="rounded-2xl border border-border bg-card p-5 shadow-soft">
			<p class="text-[11px] uppercase tracking-wider text-muted-foreground">
				{$t('finance.collectedFiltered')}
			</p>
			<p class="mt-1 font-display text-2xl font-semibold tabular-nums">
				{collected.toLocaleString()} FCFA
			</p>
		</div>
		<div class="rounded-2xl border border-border bg-card p-5 shadow-soft">
			<p class="text-[11px] uppercase tracking-wider text-muted-foreground">
				{$t('finance.pending')}
			</p>
			<p class="mt-1 font-display text-2xl font-semibold tabular-nums text-highlight">
				{pending.toLocaleString()} FCFA
			</p>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<div
			class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
		>
			<div class="col-span-2">{$t('events.date')}</div>
			<div class="col-span-4">{$t('events.student')}</div>
			<div class="col-span-3">{$t('billing.fee')}</div>
			<div class="col-span-2 text-right">{$t('eval.average')}</div>
			<div class="col-span-1 text-right">{$t('students.status')}</div>
		</div>
		<ul>
			{#each list as r (r.id)}
				{@const st = students.find((s) => s.id === r.studentId)}
				{@const fee = fees.find((f) => f.id === r.feeId)}
				<li
					class="grid grid-cols-12 items-center gap-4 border-b border-border px-5 py-3 last:border-b-0"
				>
					<div class="col-span-2 font-mono text-xs text-muted-foreground">
						{new Date(r.date).toLocaleDateString($locale, {
							day: 'numeric',
							month: 'short',
							year: '2-digit',
						})}
					</div>
					<div class="col-span-4 text-sm font-medium">{st?.name}</div>
					<div class="col-span-3 text-sm text-foreground/70">{fee?.name}</div>
					<div class="col-span-2 text-right font-display text-sm font-semibold tabular-nums">
						{r.amount.toLocaleString()} FCFA
					</div>
					<div class="col-span-1 flex justify-end">
						{#if r.status === 'paid'}
							<span
								class="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-foreground"
							>
								<Check class="h-3 w-3" />
								{$t('installment.paid')}
							</span>
						{:else}
							<span
								class="flex items-center gap-1 rounded-full bg-highlight-soft px-2 py-0.5 text-[10px] font-medium text-highlight"
							>
								<Clock class="h-3 w-3" />
								{$t('installment.pending')}
							</span>
						{/if}
					</div>
				</li>
			{/each}
			{#if list.length === 0}
				<li class="px-5 py-12 text-center text-sm text-muted-foreground">
					{$t('finance.noPayments')}
				</li>
			{/if}
		</ul>
	</div>
</div>
