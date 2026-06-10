<script lang="ts">
	import { X } from 'lucide-svelte';
	import { t } from '$lib/i18n';
	import Button from '$lib/components/ui/button/button.svelte';
	import type { DrawerItem } from './drawer-types';
	import { kindStyle, kindLabelKey } from './drawer-constants';
	import StudentTabs from './StudentTabs.svelte';
	import StudentDetailsDialog from './StudentDetailsDialog.svelte';
	import SubjectForm from './SubjectForm.svelte';
	import PlanningForm from './PlanningForm.svelte';
	import EvaluationForm from './EvaluationForm.svelte';
	import GuardianForm from './GuardianForm.svelte';
	import StaffForm from './StaffForm.svelte';
	import DeadlineDetail from './DeadlineDetail.svelte';
	import BillingDetail from './BillingDetail.svelte';
	import FeeForm from './FeeForm.svelte';
	import SchoolYearEventForm from './SchoolYearEventForm.svelte';
	import IncidentDetail from './IncidentDetail.svelte';
	import RoleDetail from './RoleDetail.svelte';
	import LevelDetail from './LevelDetail.svelte';
	import ActivityDetail from './ActivityDetail.svelte';
	import ReportCardDefinitionDetail from './ReportCardDefinitionDetail.svelte';
	import ReportCardResultDetail from './ReportCardResultDetail.svelte';

	let { item, onClose }: { item: DrawerItem | null; onClose: () => void } = $props();

	const showSave = $derived(
		item !== null &&
			item.kind !== 'role' &&
			item.kind !== 'level' &&
			item.kind !== 'activity' &&
			item.kind !== 'reportCardDefinition' &&
			item.kind !== 'reportCardResult'
	);
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
				<StudentTabs s={item.data} />
			{:else if item.kind === 'subject'}
				<SubjectForm s={item.data} />
			{:else if item.kind === 'planning'}
				<PlanningForm s={item.data} />
			{:else if item.kind === 'evaluation'}
				<EvaluationForm s={item.data} />
			{:else if item.kind === 'guardian'}
				<GuardianForm g={item.data} />
			{:else if item.kind === 'staff'}
				<StaffForm s={item.data} />
			{:else if item.kind === 'deadline'}
				<DeadlineDetail d={item.data} />
			{:else if item.kind === 'billing'}
				<BillingDetail b={item.data} />
			{:else if item.kind === 'fee'}
				<FeeForm f={item.data} />
			{:else if item.kind === 'schoolYearEvent'}
				<SchoolYearEventForm ev={item.data} />
			{:else if item.kind === 'incident'}
				<IncidentDetail i={item.data} />
			{:else if item.kind === 'role'}
				<RoleDetail role={item.data.role} />
			{:else if item.kind === 'level'}
				<LevelDetail label={item.data.label} subtitle={item.data.subtitle} items={item.data.items} />
			{:else if item.kind === 'activity'}
				<ActivityDetail a={item.data} />
			{:else if item.kind === 'reportCardDefinition'}
				<ReportCardDefinitionDetail definition={item.data} />
			{:else if item.kind === 'reportCardResult'}
				<ReportCardResultDetail result={item.data} />
			{/if}
		</div>

		<footer class="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
			{#if item.kind === 'student'}
				<StudentDetailsDialog s={item.data} />
			{/if}
			<Button variant="ghost" onclick={onClose} class="rounded-full">{$t('common.cancel')}</Button>
			{#if showSave}
				<Button class="rounded-full">{$t('common.save')}</Button>
			{/if}
		</footer>
	</aside>
{/if}
