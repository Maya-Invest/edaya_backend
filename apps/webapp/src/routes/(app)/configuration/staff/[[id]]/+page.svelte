<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PeopleView from '$lib/components/school/PeopleView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('config.staff')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<PeopleView
		staff={data.staff}
		guardians={data.guardians}
		students={data.students}
		forcedTab="staff"
		onSelectGuardian={(g) => goto(detailHref.configStaffGuardian(g.id))}
		onSelectStaff={(s) => goto(detailHref.configStaffMember(s.id))}
		{selectedId}
	/>
</DataState>
