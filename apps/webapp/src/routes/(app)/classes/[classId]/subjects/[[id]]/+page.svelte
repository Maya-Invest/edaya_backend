<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import SubjectsView from '$lib/components/school/SubjectsView.svelte';
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
	emptyTitle={$t('tab.subjects')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<SubjectsView
		subjects={data.subjects}
		onSelect={s => appGoto(detailHref.classSubject(data.classId, s.id))}
		{selectedId}
	/>
</DataState>
