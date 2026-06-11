<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import HomeworkView from '$lib/components/school/HomeworkView.svelte';
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
	emptyTitle={$t('tab.homework')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<HomeworkView
		classId={data.classId}
		deadlines={data.deadlines}
		onSelect={d => appGoto(detailHref.classDeadline(data.classId, d.id))}
		{selectedId}
	/>
</DataState>
