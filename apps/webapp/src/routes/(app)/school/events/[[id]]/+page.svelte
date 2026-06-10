<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import SchoolEventsView from '$lib/components/school/SchoolEventsView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		onSelect={(i) => goto(detailHref.schoolIncident(i.id))}
		{selectedId}
	/>
</DataState>
