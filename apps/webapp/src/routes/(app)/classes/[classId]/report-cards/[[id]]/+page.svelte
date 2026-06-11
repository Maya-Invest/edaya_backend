<script lang="ts">
	import { page } from '$app/stores';
	import ClassReportCardsView from '$lib/components/school/ClassReportCardsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { queryClassReportCardsPage } from '$lib/queries/report-cards.queries';

	const selectedId = $derived($page.params.id);
	const classId = $derived($page.params.classId ?? '6a');
	const query = $derived(queryClassReportCardsPage(classId));
</script>

<PageQuery {query} loadingTitle={$t('reportCards.classTitle')}>
	{#snippet children(data)}
		<DataState
			status={data.status}
			errorMessage={data.errorMessage}
			emptyTitle={$t('reportCards.classTitle')}
			emptyDescription={$t('dataState.emptyDescription')}
		>
			<ClassReportCardsView
				classId={data.classId}
				onSelect={r => appGoto(detailHref.classReportCard(data.classId, r.id))}
				{selectedId}
			/>
		</DataState>
	{/snippet}
</PageQuery>
