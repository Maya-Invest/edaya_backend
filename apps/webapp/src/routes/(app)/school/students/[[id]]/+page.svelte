<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import SchoolStudentsView from '$lib/components/school/SchoolStudentsView.svelte';
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
	emptyTitle={$t('school.students')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<SchoolStudentsView
		students={data.students}
		classes={data.classes}
		hierarchy={data.hierarchy}
		onSelect={s => appGoto(detailHref.schoolStudent(s.id))}
		{selectedId}
	/>
</DataState>
