<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import PeopleView from '$lib/components/school/PeopleView.svelte';
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
	emptyTitle={$t('config.staff')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<PeopleView
		staff={data.staff}
		guardians={data.guardians}
		students={data.students}
		forcedTab="staff"
		onSelectGuardian={g => appGoto(detailHref.configStaffGuardian(g.id))}
		onSelectStaff={s => appGoto(detailHref.configStaffMember(s.id))}
		{selectedId}
	/>
</DataState>
