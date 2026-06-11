<script lang="ts">
	import type { PageData } from './$types';
	import ConfigSubjectsView from '$lib/components/school/ConfigSubjectsView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';

	const { data }: { data: PageData } = $props();
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
		onSelect={s => appGoto(detailHref.configSubject(s.id))}
		onSelectLevel={g => appGoto(detailHref.configSubjectLevel(g.label))}
	/>
</DataState>
