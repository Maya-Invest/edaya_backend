<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import EvaluationsView from '$lib/components/school/EvaluationsView.svelte';
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
	emptyTitle={$t('tab.evaluations')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<EvaluationsView
		evaluations={data.evaluations}
		onSelect={ev => appGoto(detailHref.classEvaluation(data.classId, ev.id))}
		{selectedId}
	/>
</DataState>
