<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import PlanningView from '$lib/components/school/PlanningView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';

	const { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('tab.timetable')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<PlanningView
		events={data.planning}
		classes={data.classes}
		students={data.students}
		onSelect={ev => appGoto(detailHref.classPlanning(data.classId, ev.id))}
		{selectedId}
	/>
</DataState>
