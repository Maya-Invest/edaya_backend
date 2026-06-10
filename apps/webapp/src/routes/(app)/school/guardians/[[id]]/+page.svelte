<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import GuardiansView from '$lib/components/school/GuardiansView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('school.guardians')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<GuardiansView
		guardians={data.guardians}
		students={data.students}
		onSelect={(g) => goto(detailHref.schoolGuardian(g.id))}
		{selectedId}
	/>
</DataState>
