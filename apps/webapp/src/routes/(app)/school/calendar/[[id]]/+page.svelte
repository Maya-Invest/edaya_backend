<script lang="ts">
	import type { PageData } from './$types';
	import SchoolCalendarView from '$lib/components/school/SchoolCalendarView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';

	const { data }: { data: PageData } = $props();
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
		onSelect={ev => appGoto(detailHref.schoolCalendarEvent(ev.id))}
	/>
</DataState>
