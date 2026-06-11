<script lang="ts">
	import { page } from '$app/stores';
	import TeachingLogView from '$lib/components/school/TeachingLogView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryClassTeachingPage } from '$lib/queries/subjects.queries';

	const selectedSubjectId = $derived($page.params.id);
	const classId = $derived($page.params.classId ?? '6a');
	const query = $derived(queryClassTeachingPage(classId));
</script>

<PageQuery {query} loadingTitle={$t('tab.teaching')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('tab.teaching')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<TeachingLogView
				classId={data.classId}
				subjects={data.subjects}
				onSelectSubject={s => appGoto(detailHref.classTeachingSubject(data.classId, s.id))}
				{selectedSubjectId}
			/>
		</DataState>
	{/snippet}
</PageQuery>
