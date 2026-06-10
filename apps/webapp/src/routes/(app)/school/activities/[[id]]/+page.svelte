<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import ActivitiesView from '$lib/components/school/ActivitiesView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('school.activities')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<ActivitiesView
		activities={data.activities}
		onSelect={(a) => goto(detailHref.schoolActivity(a.id))}
		{selectedId}
	/>
</DataState>
