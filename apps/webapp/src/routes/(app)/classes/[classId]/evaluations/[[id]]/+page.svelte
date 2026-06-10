<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import EvaluationsView from '$lib/components/school/EvaluationsView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		onSelect={(ev) => goto(detailHref.classEvaluation(data.classId, ev.id))}
		{selectedId}
	/>
</DataState>
