<script lang="ts">
	import { FileSpreadsheet, Sparkles } from '$lib/icons';
	import type { ReportCardResult } from '$lib/data/report-cards';
	import { formatGrade, gradeScaleById } from '$lib/data/report-cards';
	import { students } from '$lib/data/school';
	import { academicContext } from '$lib/academic/context.svelte';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { cn } from '$lib/utils';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/toast.svelte';
	import { get } from 'svelte/store';

	let {
		classId,
		onSelect,
		selectedId
	}: {
		classId: string;
		onSelect?: (r: ReportCardResult) => void;
		selectedId?: string;
	} = $props();

	const results = $derived(reportCardsContext.resultsForClass(classId));

	const period = $derived(academicContext.period);
	const classStudents = $derived(students.filter((s) => s.classId === classId));

	const statusLabel: Record<ReportCardResult['status'], string> = {
		draft: 'Brouillon',
		generated: 'Généré',
		published: 'Publié'
	};

	function resultForStudent(studentId: string) {
		return results.find((r) => r.studentId === studentId);
	}

	function generateAll() {
		const n = reportCardsContext.generateForClass(classId);
		toast.success(get(t)('reportCards.toastGeneratedClass', { n: String(n) }));
	}

	function generateOne(studentId: string) {
		const r = reportCardsContext.generateResult(studentId);
		if (r) {
			const name = students.find((s) => s.id === studentId)?.name ?? '';
			toast.success(get(t)('reportCards.toastGenerated', { name }));
		}
	}

	function publishOne(resultId: string) {
		const r = reportCardsContext.publishResult(resultId);
		if (r) {
			const name = students.find((s) => s.id === r.studentId)?.name ?? '';
			toast.success(get(t)('reportCards.toastPublished', { name }));
		}
	}
</script>

<div class="animate-fade-in">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="font-mono text-xs uppercase tracking-widest text-muted-foreground">
				{$t('reportCards.classSubtitle')} · {period?.label ?? '—'}
			</p>
			<h2 class="font-display text-2xl font-semibold">{$t('reportCards.classTitle')}</h2>
		</div>
		<Button class="rounded-full" onclick={generateAll}>
			<Sparkles class="h-4 w-4" />
			{$t('reportCards.generateAll')}
		</Button>
	</div>

	<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
		<table class="w-full text-sm">
			<thead class="border-b border-border bg-secondary/30 text-left">
				<tr>
					<th class="px-4 py-3 font-medium">{$t('tab.students')}</th>
					<th class="px-4 py-3 font-medium">{$t('reportCards.overall')}</th>
					<th class="px-4 py-3 font-medium">{$t('reportCards.rank')}</th>
					<th class="px-4 py-3 font-medium">{$t('reportCards.status')}</th>
					<th class="px-4 py-3 text-right font-medium">{$t('classGroups.actions')}</th>
				</tr>
			</thead>
			<tbody>
				{#each classStudents as student (student.id)}
					{@const result = resultForStudent(student.id)}
					{@const scale = result ? gradeScaleById(result.gradeScaleId) : null}
					<tr
						class={cn(
							'border-b border-border/60 last:border-0',
							selectedId === result?.id && 'bg-primary/5'
						)}
					>
						<td class="px-4 py-3">
							<button
								type="button"
								class="text-left font-medium hover:text-primary"
								onclick={() => result && onSelect?.(result)}
							>
								{student.name}
							</button>
						</td>
						<td class="px-4 py-3 font-mono">
							{result && scale ? formatGrade(result.overallAverage, scale.id) : '—'}
						</td>
						<td class="px-4 py-3 font-mono">
							{result ? `${result.classRank}/${result.classSize}` : '—'}
						</td>
						<td class="px-4 py-3">
							{#if result}
								<span
									class={cn(
										'rounded-full px-2 py-0.5 font-mono text-[10px] uppercase',
										result.status === 'published'
											? 'bg-accent/15'
											: result.status === 'generated'
												? 'bg-highlight-soft text-highlight'
												: 'bg-secondary text-muted-foreground'
									)}
								>
									{statusLabel[result.status]}
								</span>
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-1">
								{#if !result}
									<Button size="sm" variant="outline" class="rounded-full" onclick={() => generateOne(student.id)}>
										<FileSpreadsheet class="h-3.5 w-3.5" />
										{$t('reportCards.generate')}
									</Button>
								{:else if result.status === 'generated'}
									<Button size="sm" class="rounded-full" onclick={() => publishOne(result.id)}>
										{$t('reportCards.publish')}
									</Button>
								{/if}
								{#if result}
									<Button size="sm" variant="ghost" class="rounded-full" onclick={() => onSelect?.(result)}>
										{$t('reportCards.view')}
									</Button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
