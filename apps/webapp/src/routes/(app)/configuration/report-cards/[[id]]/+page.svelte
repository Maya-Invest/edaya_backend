<script lang="ts">
	import { page } from '$app/stores';
	import ReportCardDefinitionsView from '$lib/components/school/configuration/ReportCardDefinitionsView.svelte';
	import { detailHref } from '$lib/detail-hrefs';
	import { appGoto } from '$lib/navigation/app-navigation';
	import { reportCardsContext } from '$lib/report-cards/context.svelte';
</script>

<ReportCardDefinitionsView
	definitions={reportCardsContext.definitions}
	onSelect={d => appGoto(detailHref.configReportCard(d.id))}
	selectedId={$page.params.id}
/>
