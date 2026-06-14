<script lang="ts">
	import { page } from '$app/stores';
	import PeopleView from '$lib/components/school/configuration/PeopleView.svelte';
	import DataState from '$lib/components/ui/DataState.svelte';
	import PageQuery from '$lib/components/ui/PageQuery.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { t } from '$lib/i18n';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { querySchoolStaffPage } from '$lib/queries/people.queries';

	const selectedId = $derived($page.params.id);
	const query = querySchoolStaffPage();
</script>

<PageQuery {query} loadingTitle={$t('config.staff')}>
	{#snippet children(data)}
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
	{/snippet}
</PageQuery>
