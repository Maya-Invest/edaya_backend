<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import TeachingLogView from '$lib/components/school/TeachingLogView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		onSelectSubject={(s) => goto(detailHref.classTeachingSubject(data.classId, s.id))}
		{selectedSubjectId}
	/>
</DataState>
