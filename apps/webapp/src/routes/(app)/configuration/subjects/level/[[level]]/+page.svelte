<script lang="ts">
	import ConfigSubjectsView from '$lib/components/school/academics/ConfigSubjectsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryConfigSubjectsPage } from '$lib/queries/subjects.queries';

	const query = queryConfigSubjectsPage();
</script>

<PageQuery {query} loadingTitle={$t('config.subjects')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('config.subjects')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<ConfigSubjectsView
				subjects={data.subjects}
				classes={data.classes}
				onSelect={s => appGoto(detailHref.configSubject(s.id))}
				onSelectLevel={g => appGoto(detailHref.configSubjectLevel(g.label))}
			/>
		</DataState>
	{/snippet}
</PageQuery>
