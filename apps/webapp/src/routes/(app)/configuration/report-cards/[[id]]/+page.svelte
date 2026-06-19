<script lang="ts">
	import { page } from '$app/stores';
	import ReportCardDefinitionsView from '$lib/components/school/configuration/ReportCardDefinitionsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryReportCardDefinitionsPage } from '$lib/queries/academic.queries';

	const selectedId = $derived($page.params.id);
	const query = queryReportCardDefinitionsPage();
</script>

<PageQuery {query} loadingTitle={$t('reportCards.subtitle')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('reportCards.modelsTitle', { n: 0 })}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<ReportCardDefinitionsView
				definitions={data.definitions}
				onSelect={d => appGoto(detailHref.configReportCard(d.id))}
				{selectedId}
			/>
		</DataState>
	{/snippet}
</PageQuery>
