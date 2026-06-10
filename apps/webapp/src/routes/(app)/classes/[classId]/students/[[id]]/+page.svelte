<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import StudentsView from '$lib/components/school/StudentsView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('tab.students')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<StudentsView
		students={data.students}
		className={data.currentClass.name}
		classLevel={data.currentClass.level}
		onSelect={(s) => goto(detailHref.classStudent(data.classId, s.id))}
		{selectedId}
	/>
</DataState>
