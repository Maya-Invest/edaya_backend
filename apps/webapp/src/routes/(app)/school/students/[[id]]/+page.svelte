<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import SchoolStudentsView from '$lib/components/school/SchoolStudentsView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
		onSelect={(s) => goto(detailHref.schoolStudent(s.id))}
		{selectedId}
	/>
</DataState>
