<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import SubjectsView from '$lib/components/school/SubjectsView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('tab.subjects')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<SubjectsView
		subjects={data.subjects}
		onSelect={(s) => goto(detailHref.classSubject(data.classId, s.id))}
		{selectedId}
	/>
</DataState>
