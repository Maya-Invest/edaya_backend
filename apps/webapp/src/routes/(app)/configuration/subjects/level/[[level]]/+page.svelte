<script lang="ts">
	import { goto } from '$app/navigation';
	import DataState from '$lib/components/ui/DataState.svelte';
	import ConfigSubjectsView from '$lib/components/school/ConfigSubjectsView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('config.subjects')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<ConfigSubjectsView
		subjects={data.subjects}
		classes={data.classes}
		onSelect={(s) => goto(detailHref.configSubject(s.id))}
		onSelectLevel={(g) => goto(detailHref.configSubjectLevel(g.label))}
	/>
</DataState>
