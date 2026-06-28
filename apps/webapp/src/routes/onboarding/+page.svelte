<script lang="ts">
	import type { OnboardingStep } from '$lib/onboarding/types';
	import { page } from '$app/stores';
	import { authSession } from '$lib/auth/session.svelte';
	import OnboardingShell from '$lib/components/onboarding/OnboardingShell.svelte';
	import OnboardingStepContent from '$lib/components/onboarding/OnboardingStepContent.svelte';
	import { appGoto, appPath } from '$lib/navigation/app-navigation';
	import { onboardingContext } from '$lib/onboarding/context.svelte';
	import {
		canVisitOnboardingStep,
		clampOnboardingStep,
		parseOnboardingStep,
		writeOnboardingStepUrl,
	} from '$lib/onboarding/navigation';
	import {
		canAdvanceFromStep,
		getOnboardingStepDefinition,
		nextOnboardingStep,
		previousOnboardingStep,
	} from '$lib/onboarding/steps';

	let busy = $state(false);

	const currentStep = $derived(parseOnboardingStep($page.url));
	const maxReachedStep = $derived(onboardingContext.draft.maxReachedStep);
	const stepDefinition = $derived(getOnboardingStepDefinition(currentStep));
	const canAdvance = $derived(canAdvanceFromStep(currentStep, onboardingContext.draft));
	const canGoBack = $derived(currentStep > 1);
	const nextStep = $derived(nextOnboardingStep(currentStep));
	const showContinue = $derived(nextStep !== null);
	const showSkip = $derived(Boolean(stepDefinition.optional && nextStep !== null));

	$effect(() => {
		const authUserId = authSession.authUserId;
		if (authUserId) {
			onboardingContext.init(authUserId);
		}
	});

	$effect(() => {
		if (!onboardingContext.initialized) {
			return;
		}

		const requested = parseOnboardingStep($page.url);
		const allowed = clampOnboardingStep(requested, maxReachedStep);
		if (requested !== allowed) {
			appGoto(writeOnboardingStepUrl($page.url, allowed), { replaceState: true });
		}
	});

	function navigateToStep(step: OnboardingStep) {
		if (!canVisitOnboardingStep(step, maxReachedStep)) {
			return;
		}
		appGoto(writeOnboardingStepUrl($page.url, step));
	}

	function goBack() {
		const previous = previousOnboardingStep(currentStep);
		if (previous) {
			navigateToStep(previous);
		}
	}

	function goNext() {
		if (!canAdvance || !nextStep) {
			return;
		}
		onboardingContext.markStepReached(nextStep);
		appGoto(writeOnboardingStepUrl($page.url, nextStep));
	}

	function skipStep() {
		if (!stepDefinition.optional || !nextStep) {
			return;
		}
		onboardingContext.markStepReached(nextStep);
		appGoto(writeOnboardingStepUrl($page.url, nextStep));
	}

	async function signOut() {
		busy = true;
		try {
			await authSession.logout();
			onboardingContext.reset();
			appGoto(appPath('/login'), { replaceState: true });
		}
		finally {
			busy = false;
		}
	}
</script>

{#if onboardingContext.initialized}
	<OnboardingShell
		{currentStep}
		{maxReachedStep}
		{canAdvance}
		{canGoBack}
		{showSkip}
		{showContinue}
		{busy}
		onBack={goBack}
		onContinue={goNext}
		onSkip={skipStep}
		onStepSelect={navigateToStep}
		onSignOut={() => void signOut()}
	>
		<OnboardingStepContent step={currentStep} />
	</OnboardingShell>
{/if}
