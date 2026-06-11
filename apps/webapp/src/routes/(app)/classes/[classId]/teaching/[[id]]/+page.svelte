<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import TeachingLogView from '$lib/components/school/TeachingLogView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';

	const { data }: { data: PageData } = $props();

	const selectedSubjectId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('tab.teaching')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<TeachingLogView
		classId={data.classId}
		subjects={data.subjects}
		onSelectSubject={s => appGoto(detailHref.classTeachingSubject(data.classId, s.id))}
		{selectedSubjectId}
	/>
</DataState>
