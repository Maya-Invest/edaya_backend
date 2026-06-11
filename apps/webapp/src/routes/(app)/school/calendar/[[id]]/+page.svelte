<script lang="ts">
	import SchoolCalendarView from '$lib/components/school/SchoolCalendarView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { querySchoolCalendarPage } from '$lib/queries/school-life.queries';

	const query = querySchoolCalendarPage();
</script>

<PageQuery {query} loadingTitle={$t('school.calendar')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('school.calendar')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<SchoolCalendarView
				events={data.events}
				classes={data.classes}
				onSelect={ev => appGoto(detailHref.schoolCalendarEvent(ev.id))}
			/>
		</DataState>
	{/snippet}
</PageQuery>
