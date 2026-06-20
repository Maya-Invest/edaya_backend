<script lang="ts">
	import type { PlanningEvent } from '$lib/types/school';
	import { page } from '$app/stores';
	import { academicContext } from '$lib/academic/context.svelte';
	import PlanningView from '$lib/components/school/scheduling/PlanningView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { LoaderCircle } from '$lib/icons';
	import { appGoto } from '$lib/navigation/app-navigation';

	const selectedId = $derived($page.params.id);
	const classId = $derived($page.params.classId ?? '6a');
	const events = $derived(detailDataContext.planning.filter(event => event.classId === classId));
	const students = $derived(detailDataContext.students.filter(student => student.classId === classId));
	const status = $derived(
		!detailDataContext.ready ? 'loading' : events.length === 0 ? 'empty' : 'ready',
	);
</script>

{#if !detailDataContext.ready}
	<div
		class="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 animate-fade-in"
		role="status"
		aria-live="polite"
	>
		<LoaderCircle class="h-8 w-8 animate-spin text-primary" />
		<p class="text-sm text-muted-foreground">{$t('tab.timetable')}</p>
	</div>
{:else}
	<DataState
		{status}
		emptyTitle={$t('tab.timetable')}
		emptyDescription={$t('dataState.emptyDescription')}
	>
		<PlanningView
			{classId}
			{events}
			classes={academicContext.classes}
			{students}
			onSelect={ev => appGoto(detailHref.classPlanning(classId, ev.id))}
			{selectedId}
		/>
	</DataState>
{/if}
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
