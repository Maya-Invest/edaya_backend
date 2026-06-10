<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ReportCardDefinitionsView from '$lib/components/school/ReportCardDefinitionsView.svelte';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
	import { detailHref } from '$lib/detail-hrefs';
</script>

<ReportCardDefinitionsView
	definitions={reportCardsContext.definitions}
	onSelect={(d) => goto(detailHref.configReportCard(d.id))}
	selectedId={$page.params.id}
/>
