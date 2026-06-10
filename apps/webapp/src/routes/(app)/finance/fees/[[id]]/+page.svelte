<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DataState from '$lib/components/ui/DataState.svelte';
	import FinanceView from '$lib/components/school/FinanceView.svelte';
	import { detailHref } from '$lib/detail-routes';
	import { t } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const selectedId = $derived($page.params.id);
</script>

<DataState
	status={data.status}
	errorMessage={data.errorMessage}
	emptyTitle={$t('finance.fees')}
	emptyDescription={$t('dataState.emptyDescription')}
>
	<FinanceView
		fees={data.fees}
		billing={data.billing}
		students={data.students}
		forcedTab="fees"
		onSelectBilling={(b) => goto(detailHref.financeBilling(b.id))}
		onSelectFee={(f) => goto(detailHref.financeFee(f.id))}
		{selectedId}
	/>
</DataState>
