<script lang="ts">
	import type { DrawerItem } from './drawer-types';
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';
	import { X } from '$lib/icons';
	import { kindStyle, kindLabelKey } from './drawer-constants';

	const { item, onClose }: { item: DrawerItem | null; onClose: () => void } = $props();

	const nonSaveKinds = new Set(['role', 'level', 'activity', 'reportCardDefinition', 'reportCardResult']);

	const showSave = $derived(item !== null && !nonSaveKinds.has(item.kind));
</script>

{#if item}
	<div
		role="presentation"
		onclick={onClose}
		class="fixed inset-0 z-40 animate-fade-in bg-primary/5"
	></div>
	<aside
		class="fixed right-0 top-0 z-50 flex h-full w-1/2 animate-slide-in-right flex-col border-l border-border bg-card shadow-panel"
	>
		<header class="flex items-center justify-between border-b border-border px-6 py-4">
			<span
				class="rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider {kindStyle[item.kind]}"
			>
				{$t(kindLabelKey[item.kind])}
			</span>
			<button
				onclick={onClose}
				class="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			>
				<X class="h-4 w-4" />
			</button>
		</header>

		<div class="scrollbar-thin flex-1 overflow-y-auto px-6 py-6">
			{#if item.kind === 'student'}
				{#await import('./StudentTabs.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: StudentTabs }}
					<StudentTabs s={item.data} />
				{/await}
			{:else if item.kind === 'subject'}
				{#await import('./SubjectForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: SubjectForm }}
					<SubjectForm s={item.data} />
				{/await}
			{:else if item.kind === 'planning'}
				{#await import('./PlanningForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: PlanningForm }}
					<PlanningForm s={item.data} />
				{/await}
			{:else if item.kind === 'evaluation'}
				{#await import('./EvaluationForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: EvaluationForm }}
					<EvaluationForm s={item.data} />
				{/await}
			{:else if item.kind === 'guardian'}
				{#await import('./GuardianForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: GuardianForm }}
					<GuardianForm g={item.data} />
				{/await}
			{:else if item.kind === 'staff'}
				{#await import('./StaffForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: StaffForm }}
					<StaffForm s={item.data} />
				{/await}
			{:else if item.kind === 'deadline'}
				{#await import('./DeadlineDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: DeadlineDetail }}
					<DeadlineDetail d={item.data} />
				{/await}
			{:else if item.kind === 'billing'}
				{#await import('./BillingDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: BillingDetail }}
					<BillingDetail b={item.data} />
				{/await}
			{:else if item.kind === 'fee'}
				{#await import('./FeeForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: FeeForm }}
					<FeeForm f={item.data} />
				{/await}
			{:else if item.kind === 'schoolYearEvent'}
				{#await import('./SchoolYearEventForm.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: SchoolYearEventForm }}
					<SchoolYearEventForm ev={item.data} />
				{/await}
			{:else if item.kind === 'incident'}
				{#await import('./IncidentDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: IncidentDetail }}
					<IncidentDetail i={item.data} />
				{/await}
			{:else if item.kind === 'role'}
				{#await import('./RoleDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: RoleDetail }}
					<RoleDetail role={item.data.role} />
				{/await}
			{:else if item.kind === 'level'}
				{#await import('./LevelDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: LevelDetail }}
					<LevelDetail label={item.data.label} subtitle={item.data.subtitle} items={item.data.items} />
				{/await}
			{:else if item.kind === 'activity'}
				{#await import('./ActivityDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: ActivityDetail }}
					<ActivityDetail a={item.data} />
				{/await}
			{:else if item.kind === 'reportCardDefinition'}
				{#await import('./ReportCardDefinitionDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: ReportCardDefinitionDetail }}
					<ReportCardDefinitionDetail definition={item.data} />
				{/await}
			{:else if item.kind === 'reportCardResult'}
				{#await import('./ReportCardResultDetail.svelte')}
					<p class="text-sm text-muted-foreground">{$t('dataState.loading')}</p>
				{:then { default: ReportCardResultDetail }}
					<ReportCardResultDetail result={item.data} />
				{/await}
			{/if}
		</div>

		<footer class="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
			{#if item.kind === 'student'}
				{#await import('./StudentDetailsDialog.svelte')}
					<span></span>
				{:then { default: StudentDetailsDialog }}
					<StudentDetailsDialog s={item.data} />
				{/await}
			{/if}
			<Button variant="ghost" onclick={onClose} class="rounded-full">{$t('common.cancel')}</Button>
			{#if showSave}
				<Button class="rounded-full">{$t('common.save')}</Button>
			{/if}
		</footer>
	</aside>
{/if}
