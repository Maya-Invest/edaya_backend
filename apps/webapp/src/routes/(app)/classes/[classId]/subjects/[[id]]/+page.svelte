<script lang="ts">
	import { page } from '$app/stores';
	import SubjectsView from '$lib/components/school/academics/SubjectsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryClassSubjectsPage } from '$lib/queries/subjects.queries';

	const selectedId = $derived($page.params.id);
	const classId = $derived($page.params.classId ?? '6a');
	const query = $derived(queryClassSubjectsPage(classId));
</script>

<PageQuery {query} loadingTitle={$t('tab.subjects')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('tab.subjects')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<SubjectsView
				classId={data.classId}
				onSelect={s => appGoto(detailHref.classSubject(data.classId, s.id))}
				{selectedId}
			/>
		</DataState>
	{/snippet}
</PageQuery>
