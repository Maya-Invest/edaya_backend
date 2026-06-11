<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import ActivitiesView from '$lib/components/school/ActivitiesView.svelte';
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
	emptyTitle={$t('school.activities')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<ActivitiesView
		activities={data.activities}
		onSelect={a => appGoto(detailHref.schoolActivity(a.id))}
		{selectedId}
	/>
</DataState>
