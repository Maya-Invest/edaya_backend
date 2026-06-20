<script lang="ts">
	import type { PlanningEvent } from '$lib/types/school';
	import { page } from '$app/stores';
	import PlanningView from '$lib/components/school/scheduling/PlanningView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryClassTimetablePage } from '$lib/queries/planning.queries';

	const selectedId = $derived($page.params.id);
	const classId = $derived($page.params.classId ?? '6a');
	const query = $derived(queryClassTimetablePage(classId));

	function selectSession(ev: PlanningEvent) {
		const path = detailHref.classPlanning(classId, ev.id);
		appGoto(`${path}${$page.url.search}`);
	}
</script>

<PageQuery {query} loadingTitle={$t('tab.timetable')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('tab.timetable')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<PlanningView
				classId={data.classId}
				events={data.planning}
				classes={data.classes}
				students={data.students}
				onSelect={selectSession}
				{selectedId}
			/>
		</DataState>
	{/snippet}
</PageQuery>
