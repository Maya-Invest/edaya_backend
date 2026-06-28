<script lang="ts">
	import type { OnboardingStep } from '$lib/onboarding/types';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { t } from '$lib/i18n';
	import { onboardingContext } from '$lib/onboarding/context.svelte';
	import { getOnboardingStepDefinition } from '$lib/onboarding/steps';

	interface Props {
		step: OnboardingStep;
	}

	const { step }: Props = $props();

	const definition = $derived(getOnboardingStepDefinition(step));

	function persistDraft() {
		onboardingContext.persist();
	}
</script>

<div class="space-y-4">
	<header>
		<p class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
			{$t('onboarding.stepProgress', { current: step, total: 4 })}
		</p>
		<h1 class="mt-1 font-display text-2xl font-semibold">
			{$t(definition.labelKey)}
		</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			{$t(definition.descriptionKey)}
		</p>
	</header>

	{#if step === 1}
		<div class="space-y-2 rounded-xl bg-secondary/40 p-4">
			<Label for="onboarding-school-name">{$t('onboarding.schoolNameLabel')}</Label>
			<Input
				id="onboarding-school-name"
				bind:value={onboardingContext.draft.school.name}
				placeholder={$t('onboarding.schoolNamePlaceholder')}
				oninput={persistDraft}
			/>
			<p class="text-xs text-muted-foreground">{$t('onboarding.schoolNameHint')}</p>
		</div>
	{:else if step === 2}
		<div class="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-sm text-muted-foreground">
			{$t('onboarding.placeholder.structure')}
		</div>
	{:else if step === 3}
		<div class="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-sm text-muted-foreground">
			{$t('onboarding.placeholder.staff')}
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-sm text-muted-foreground">
			{$t('onboarding.placeholder.complete')}
		</div>
	{/if}
</div>
