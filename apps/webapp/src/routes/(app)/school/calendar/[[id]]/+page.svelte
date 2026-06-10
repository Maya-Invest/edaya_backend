<script lang="ts">
	import { goto } from '$app/navigation';
	import DataState from '$lib/components/ui/DataState.svelte';
	import SchoolCalendarView from '$lib/components/school/SchoolCalendarView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('school.calendar')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<SchoolCalendarView
		events={data.events}
		classes={data.classes}
		onSelect={(ev) => goto(detailHref.schoolCalendarEvent(ev.id))}
	/>
</DataState>
