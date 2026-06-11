<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import ClassReportCardsView from '$lib/components/school/ClassReportCardsView.svelte';
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
	emptyTitle={$t('reportCards.classTitle')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<ClassReportCardsView
		classId={data.classId}
		onSelect={r => appGoto(detailHref.classReportCard(data.classId, r.id))}
		{selectedId}
	/>
</DataState>
