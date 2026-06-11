<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import SchoolEventsView from '$lib/components/school/SchoolEventsView.svelte';
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
	emptyTitle={$t('school.events')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<SchoolEventsView
		incidents={data.incidents}
		students={data.students}
		classes={data.classes}
		onSelect={i => appGoto(detailHref.schoolIncident(i.id))}
		{selectedId}
	/>
</DataState>
