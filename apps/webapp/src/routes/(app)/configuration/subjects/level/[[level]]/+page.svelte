<script lang="ts">
	import { page } from '$app/stores';
	import ConfigSubjectsView from '$lib/components/school/academics/ConfigSubjectsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryConfigSubjectsPage } from '$lib/queries/subjects.queries';
	import type { Subject } from '$lib/types/school';

	const query = queryConfigSubjectsPage();

	function selectSubject(subject: Subject) {
		const path = detailHref.configSubject(subject.id);
		appGoto(`${path}${$page.url.search}`);
	}

	function selectLevel(group: { label: string }) {
		const path = detailHref.configSubjectLevel(group.label);
		appGoto(`${path}${$page.url.search}`);
	}
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
				onSelect={selectSubject}
				onSelectLevel={selectLevel}
			/>
		</DataState>
	{/snippet}
</PageQuery>
