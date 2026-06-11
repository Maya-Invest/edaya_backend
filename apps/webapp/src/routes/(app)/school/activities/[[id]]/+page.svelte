<script lang="ts">
	import { page } from '$app/stores';
	import ActivitiesView from '$lib/components/school/ActivitiesView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { querySchoolActivitiesPage } from '$lib/queries/prototype.queries';

	const selectedId = $derived($page.params.id);
	const query = querySchoolActivitiesPage();
</script>

<PageQuery {query} loadingTitle={$t('school.activities')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('school.activities')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<ActivitiesView
				activities={data.activities}
				onSelect={a => appGoto(detailHref.schoolActivity(a.id))}
				{selectedId}
			/>
		</DataState>
	{/snippet}
</PageQuery>
