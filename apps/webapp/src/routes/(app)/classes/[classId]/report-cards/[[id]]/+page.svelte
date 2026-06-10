<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import ClassReportCardsView from '$lib/components/school/ClassReportCardsView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		onSelect={(r) => goto(detailHref.classReportCard(data.classId, r.id))}
		{selectedId}
	/>
</DataState>
