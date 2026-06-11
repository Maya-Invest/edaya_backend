<script lang="ts">
	import type { Student, PedagogicalNote, Incident, AbsenceRecord, HealthRecord } from '$lib/data/school';
	import type { SubjectGroupItem } from './drawer-types';
	import { academicContext } from '$lib/academic/context.svelte';
	import { detailDataContext } from '$lib/detail-data/context.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import { t } from '$lib/i18n';
	import {
		AlertTriangle,
		Users,
		Phone,
		Mail,
		FileText,
		Plus,
		Droplet,
		Activity,
		Clock,
		Check,
		Wallet,
	} from '$lib/icons';
	import { cn } from '$lib/utils';
	import ChangeClassButton from './ChangeClassButton.svelte';
	import { relationKey, fmtDateFr } from './drawer-constants';
	import DrawerEmptyState from './DrawerEmptyState.svelte';
	import DrawerField from './DrawerField.svelte';
	import StudentAvatar from './StudentAvatar.svelte';
	import StudentReportCardPanel from './StudentReportCardPanel.svelte';
	import SubjectGroup from './SubjectGroup.svelte';

	const { s }: { s: Student } = $props();

	const incidents = $derived(detailDataContext.incidents);
	const absences = $derived(detailDataContext.absences);
	const healthRecords = $derived(detailDataContext.healthRecords);
	const pedagogicalNotes = $derived(detailDataContext.pedagogicalNotes);

	let tab = $state<'profile' | 'notes' | 'absence' | 'incidents' | 'finances' | 'bulletin'>('profile');

	const linkedG = $derived(detailDataContext.guardians.filter(g => g.studentIds.includes(s.id)));
	const health = $derived(healthRecords[s.id]);
	const studentIncidents = $derived(incidents.filter(i => i.studentId === s.id));
	const absenceRate = $derived(100 - s.attendance);
	const studentClass = $derived(academicContext.classes.find(cl => cl.id === s.classId));

	const tabLabelKeys: Record<
		'profile' | 'notes' | 'absence' | 'incidents' | 'finances' | 'bulletin',
		string | null
	> = {
		profile: 'drawer.tab.profile',
		notes: null,
		absence: null,
		incidents: 'drawer.tab.incidents',
		finances: null,
		bulletin: 'drawer.tab.reportCard',
	};
	const tabLabelFallback: Record<'notes' | 'absence' | 'finances', string> = {
		notes: 'Notes',
		absence: 'Absence',
		finances: 'Finances',
	};

	const studentNotes = $derived(
		pedagogicalNotes.filter(n => n.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)),
	);

	const toneByCategory: Record<PedagogicalNote['category'], string> = {
		Comportement: 'bg-destructive/10 text-destructive',
		Travail: 'bg-highlight-soft text-highlight',
		Progression: 'bg-secondary text-foreground/80',
		Encouragement: 'bg-secondary text-foreground/80',
	};

	const notesData = $derived.by(() => {
		const studentEvals = detailDataContext.evaluations
			.filter(e => e.classId === s.classId)
			.sort((x, y) => y.date.localeCompare(x.date));
		const seed = s.id.charCodeAt(1) || 1;
		const marks = studentEvals.map((e, idx) => {
			const base = e.graded > 0 ? (s.average / 20) * e.outOf : 0;
			const jitter = ((seed * (idx + 1)) % 5) - 2;
			return e.graded > 0 ? Math.max(0, Math.min(e.outOf, base + jitter)) : null;
		});
		const valid = marks.filter((m): m is number => m !== null);
		const weightedSum = valid.reduce(
			(acc, m, i) => acc + (m / studentEvals[i].outOf) * 20 * studentEvals[i].coefficient,
			0,
		);
		const weightTotal = valid.reduce((acc, _m, i) => acc + studentEvals[i].coefficient, 0);
		const overall = valid.length ? weightedSum / weightTotal : 0;

		const groups: Record<string, SubjectGroupItem[]> = {};
		studentEvals.forEach((e, idx) => {
			const arr = groups[e.subject] ?? [];
			arr.push({ e, mark: marks[idx] });
			groups[e.subject] = arr;
		});

		const subjectGroups = Object.entries(groups).map(([subject, items]) => {
			const graded = items.filter(it => it.mark !== null);
			const subjectWeightedSum = graded.reduce(
				(acc, it) => acc + (it.mark! / it.e.outOf) * 20 * it.e.coefficient,
				0,
			);
			const subjectWeightTotal = graded.reduce((acc, it) => acc + it.e.coefficient, 0);
			const subjectAvg = graded.length ? subjectWeightedSum / subjectWeightTotal : null;
			return { subject, items, subjectAvg };
		});

		return { studentEvals, valid, overall, subjectGroups };
	});

	const absenceData = $derived(
		absences.filter(a => a.studentId === s.id).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time)),
	);

	const incidentsData = $derived.by(() => {
		const sorted = [...studentIncidents].sort((x, y) => y.date.localeCompare(x.date));
		return {
			sorted,
			high: sorted.filter(i => i.severity === 'high').length,
			med: sorted.filter(i => i.severity === 'medium').length,
			low: sorted.filter(i => i.severity === 'low').length,
		};
	});

	const financesData = $derived.by(() => {
		const studentBilling = detailDataContext.billing.filter(b => b.studentId === s.id);
		const total = studentBilling.reduce((acc, b) => acc + b.total, 0);
		const paid = studentBilling.reduce((acc, b) => acc + b.paid, 0);
		return { studentBilling, total, paid, balance: total - paid };
	});

	const statusTone: Record<'paid' | 'partial' | 'due' | 'overdue', string> = {
		paid: 'bg-secondary text-foreground/80',
		partial: 'bg-highlight-soft text-highlight',
		due: 'bg-secondary text-muted-foreground',
		overdue: 'bg-destructive/10 text-destructive',
	};
</script>

<div class="space-y-5">
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-4">
			<StudentAvatar {s} />
			<div>
				<h3 class="font-display text-2xl font-semibold leading-tight">{s.name}</h3>
				<p class="text-sm text-muted-foreground">
					{$t('drawer.studentSummary', { avg: s.average.toFixed(1), att: s.attendance })}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			{#if studentClass}
				<div class="text-right leading-tight">
					<p class="text-sm font-semibold">{studentClass.name}</p>
					<p class="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
						{studentClass.level}
					</p>
				</div>
			{/if}
			<ChangeClassButton {s} />
		</div>
	</div>

	<div class="flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-1 text-xs">
		{#each ['profile', 'notes', 'absence', 'incidents', 'finances', 'bulletin'] as const as k (k)}
			<button
				onclick={() => (tab = k)}
				class={cn(
					'flex-1 rounded-full px-2.5 py-1.5 font-medium transition',
					tab === k ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
				)}
			>
				{tabLabelKeys[k] ? $t(tabLabelKeys[k]!) : tabLabelFallback[k as 'notes' | 'absence' | 'finances']}
			</button>
		{/each}
	</div>

	{#if tab === 'profile'}
		<div class="space-y-4">
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl bg-primary/10 p-3">
					<p class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
						<Droplet class="h-3 w-3" /> Groupe
					</p>
					<p class="mt-1 font-display text-xl">{health?.bloodType ?? '—'}</p>
				</div>
				<div class="rounded-xl bg-secondary/60 p-3">
					<p class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
						<AlertTriangle class="h-3 w-3" /> Allergies
					</p>
					{#if health?.allergies?.length}
						<div class="mt-1.5 flex flex-wrap gap-1">
							{#each health.allergies as a (a)}
								<span class="rounded-full bg-card/70 px-1.5 py-0.5 text-[10px] text-highlight">{a}</span>
							{/each}
						</div>
					{:else}
						<p class="mt-1 text-xs text-muted-foreground">Aucune</p>
					{/if}
				</div>
				<div class="rounded-xl bg-secondary/60 p-3">
					<p class="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
						<Activity class="h-3 w-3" /> Chroniques
					</p>
					{#if health?.chronicConditions?.length}
						<div class="mt-1.5 flex flex-wrap gap-1">
							{#each health.chronicConditions as c (c)}
								<span class="rounded-full bg-card/70 px-1.5 py-0.5 text-[10px] text-foreground">{c}</span>
							{/each}
						</div>
					{:else}
						<p class="mt-1 text-xs text-muted-foreground">Aucune</p>
					{/if}
				</div>
			</div>
			<DrawerField label={$t('guardian.fullName')}>
				<Input value={s.name} />
			</DrawerField>
			<DrawerField label={$t('common.email')}>
				<Input value={s.email} />
			</DrawerField>
			<div class="grid grid-cols-2 gap-3">
				<DrawerField label={$t('drawer.birthDate')}>
					<Input type="date" value={s.birthdate} />
				</DrawerField>
				<DrawerField label={$t('drawer.guardianLabel')}>
					<Input value={s.guardian} />
				</DrawerField>
			</div>

			<div class="space-y-2 border-t border-border pt-4">
				<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tuteurs</Label>
				{#if linkedG.length === 0}
					<DrawerEmptyState label={$t('drawer.noGuardian')}>
						{#snippet icon()}
							<Users class="h-5 w-5 text-muted-foreground" />
						{/snippet}
					</DrawerEmptyState>
				{:else}
					<div class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
						<div
							class="grid grid-cols-12 gap-4 border-b border-border bg-secondary/40 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
						>
							<div class="col-span-5">{$t('students.student')}</div>
							<div class="col-span-3">{$t('guardian.relationLabel')}</div>
							<div class="col-span-3">{$t('common.phone')}</div>
							<div class="col-span-1"></div>
						</div>
						<ul>
							{#each linkedG as g (g.id)}
								<li class="border-b border-border last:border-b-0">
									<div class="grid w-full grid-cols-12 items-center gap-4 px-5 py-3.5">
										<div class="col-span-5 flex items-center gap-3">
											<div
												class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-display text-xs font-semibold text-primary-foreground"
											>
												{g.initials}
											</div>
											<div class="min-w-0">
												<p class="truncate text-sm font-medium">{g.name}</p>
												<p class="flex items-center gap-1 truncate text-xs text-muted-foreground">
													<Mail class="h-3 w-3" />
													{g.email}
												</p>
											</div>
										</div>
										<div class="col-span-3">
											<span class="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
												{$t(relationKey[g.relation])}
											</span>
										</div>
										<div class="col-span-3">
											<p class="flex items-center gap-1 text-xs text-muted-foreground">
												<Phone class="h-3 w-3" />
												{g.phone}
											</p>
										</div>
										<div class="col-span-1 flex items-center gap-1">
											<button
												class="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
											>
												<Mail class="h-3.5 w-3.5" />
											</button>
											<button
												class="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
											>
												<Phone class="h-3.5 w-3.5" />
											</button>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
				<Button variant="ghost" class="w-full rounded-full border border-dashed border-border">
					{$t('drawer.linkGuardian')}
				</Button>
			</div>

			<div class="space-y-2 border-t border-border pt-4">
				<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
					Notes pédagogiques
				</Label>
				{#if studentNotes.length === 0}
					<DrawerEmptyState label="Aucune note pédagogique.">
						{#snippet icon()}
							<FileText class="h-5 w-5 text-muted-foreground" />
						{/snippet}
					</DrawerEmptyState>
				{:else}
					<ul class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
						{#each studentNotes as n (n.id)}
							{@const author = detailDataContext.staff.find(st => st.id === n.authorId)}
							<li class="border-b border-border px-4 py-3 last:border-b-0">
								<div class="flex items-center justify-between gap-2">
									<span
										class={cn(
											'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
											toneByCategory[n.category],
										)}
									>
										{n.category}
									</span>
									<span class="font-mono text-[10px] text-muted-foreground">{fmtDateFr(n.date)}</span>
								</div>
								<p class="mt-1.5 text-sm">{n.content}</p>
								<p class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
									{#if author}
										<span
											class="flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-display text-[9px] font-semibold text-foreground"
										>
											{author.initials}
										</span>
									{/if}
									<span>{author?.name ?? '—'}</span>
									{#if author?.department}
										<span>· {author.department}</span>
									{/if}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
				<Button variant="ghost" class="w-full rounded-full border border-dashed border-border">
					<Plus class="mr-1 h-4 w-4" /> Ajouter une note
				</Button>
			</div>
		</div>
	{:else if tab === 'notes'}
		<div class="space-y-4">
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl bg-primary/10 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Moyenne</p>
					<p class="mt-1 font-display text-2xl">
						{notesData.overall ? notesData.overall.toFixed(1) : '—'}<span
							class="text-sm text-muted-foreground"
						>
							/ 20</span
						>
					</p>
				</div>
				<div class="rounded-xl bg-secondary/60 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Évaluations</p>
					<p class="mt-1 font-display text-2xl">{notesData.valid.length}</p>
				</div>
				<div class="rounded-xl bg-secondary p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">À venir</p>
					<p class="mt-1 font-display text-2xl">
						{notesData.studentEvals.length - notesData.valid.length}
					</p>
				</div>
			</div>
			<div>
				<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
					Notes par matière
				</Label>
				<div class="mt-2 space-y-2">
					{#if notesData.studentEvals.length === 0}
						<DrawerEmptyState label="Aucune évaluation.">
							{#snippet icon()}
								<FileText class="h-5 w-5 text-muted-foreground" />
							{/snippet}
						</DrawerEmptyState>
					{:else}
						{#each notesData.subjectGroups as { subject, items, subjectAvg } (subject)}
							<SubjectGroup {subject} {items} {subjectAvg} />
						{/each}
					{/if}
				</div>
			</div>
			<Button variant="ghost" class="w-full rounded-full border border-dashed border-border">
				<Plus class="mr-1 h-4 w-4" /> Saisir une note
			</Button>
		</div>
	{:else if tab === 'absence'}
		<div class="space-y-4">
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl bg-primary/10 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Présence</p>
					<p class="mt-1 font-display text-2xl">{s.attendance}%</p>
				</div>
				<div class="rounded-xl bg-secondary/60 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Absence</p>
					<p class="mt-1 font-display text-2xl">{absenceRate}%</p>
				</div>
				<div class="rounded-xl bg-secondary p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
					<p class="mt-1 font-display text-2xl">{absenceData.length}</p>
				</div>
			</div>
			<div>
				<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
					Évènements d'absence
				</Label>
				<div class="mt-2 space-y-2">
					{#if absenceData.length === 0}
						<DrawerEmptyState label="Aucune absence enregistrée.">
							{#snippet icon()}
								<Clock class="h-5 w-5 text-muted-foreground" />
							{/snippet}
						</DrawerEmptyState>
					{:else}
						{#each absenceData as a (a.id)}
							<div class="rounded-xl border border-border bg-card p-3">
								<div class="flex items-center justify-between gap-2">
									<span
										class="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
									>{a.eventType}</span
									>
									<span class="font-mono text-[10px] text-muted-foreground">
										{fmtDateFr(a.date)} · {a.time}
									</span>
								</div>
								<p class="mt-1.5 text-sm font-medium">{a.subject}</p>
								{#if a.reason}
									<p class="mt-0.5 text-xs text-muted-foreground">Motif : {a.reason}</p>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
			<Button variant="ghost" class="w-full rounded-full border border-dashed border-border">
				<Plus class="mr-1 h-4 w-4" /> Déclarer une absence
			</Button>
		</div>
	{:else if tab === 'incidents'}
		<div class="space-y-4">
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl bg-destructive/10 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Élevés</p>
					<p class="mt-1 font-display text-2xl text-destructive">{incidentsData.high}</p>
				</div>
				<div class="rounded-xl bg-secondary/60 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Moyens</p>
					<p class="mt-1 font-display text-2xl">{incidentsData.med}</p>
				</div>
				<div class="rounded-xl bg-secondary p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Faibles</p>
					<p class="mt-1 font-display text-2xl">{incidentsData.low}</p>
				</div>
			</div>
			<div>
				<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Évènements</Label>
				<div class="mt-2 space-y-2">
					{#if incidentsData.sorted.length === 0}
						<DrawerEmptyState label={$t('drawer.noIncidents')}>
							{#snippet icon()}
								<AlertTriangle class="h-5 w-5 text-muted-foreground" />
							{/snippet}
						</DrawerEmptyState>
					{:else}
						{#each incidentsData.sorted as i (i.id)}
							<div class="rounded-xl border border-border bg-card p-4">
								<div class="flex items-center justify-between">
									<span
										class={cn(
											'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
											i.severity === 'high'
												? 'bg-destructive/10 text-destructive'
												: i.severity === 'medium'
												? 'bg-highlight-soft text-highlight'
												: 'bg-secondary text-muted-foreground',
										)}
									>
										{$t(`events.severity.${i.severity}`)}
									</span>
									<span class="font-mono text-[10px] text-muted-foreground">{fmtDateFr(i.date)}</span>
								</div>
								<p class="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
									{$t(`events.cat.${i.category}`)}
								</p>
								<p class="mt-1 text-sm">{i.summary}</p>
							</div>
						{/each}
					{/if}
				</div>
			</div>
			<Button variant="ghost" class="w-full rounded-full border border-dashed border-border">
				{$t('drawer.logIncident')}
			</Button>
		</div>
	{:else if tab === 'finances'}
		<div class="space-y-4">
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-xl bg-secondary p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
					<p class="mt-1 font-display text-2xl">{financesData.total.toLocaleString('fr-FR')} €</p>
				</div>
				<div class="rounded-xl bg-primary/10 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Payé</p>
					<p class="mt-1 font-display text-2xl">{financesData.paid.toLocaleString('fr-FR')} €</p>
				</div>
				<div class="rounded-xl bg-secondary/60 p-4">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground">Solde</p>
					<p class="mt-1 font-display text-2xl">{financesData.balance.toLocaleString('fr-FR')} €</p>
				</div>
			</div>
			<div>
				<Label class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Facturation</Label>
				<div class="mt-2 space-y-2">
					{#if financesData.studentBilling.length === 0}
						<DrawerEmptyState label="Aucune facture.">
							{#snippet icon()}
								<Wallet class="h-5 w-5 text-muted-foreground" />
							{/snippet}
						</DrawerEmptyState>
					{:else}
						{#each financesData.studentBilling as b (b.id)}
							{@const fee = detailDataContext.fees.find(f => f.id === b.feeId)}
							<div class="rounded-xl border border-border bg-card p-4">
								<div class="flex items-center justify-between">
									<span
										class={cn(
											'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
											statusTone[b.status],
										)}
									>
										{b.status}
									</span>
									<span class="font-mono text-[10px] text-muted-foreground">{fmtDateFr(b.dueDate)}</span>
								</div>
								<p class="mt-2 text-sm font-medium">{fee?.name ?? 'Frais'}</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{b.paid.toLocaleString('fr-FR')} € / {b.total.toLocaleString('fr-FR')} €
								</p>
								{#if b.installments.length > 0}
									<div class="mt-3 space-y-1.5 border-t border-border pt-3">
										<p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
											Détail des paiements
										</p>
										{#each b.installments as inst, idx (idx)}
											<div class="flex items-center justify-between gap-2 text-xs">
												<div class="flex items-center gap-2">
													<span
														class={cn(
															'flex h-5 w-5 items-center justify-center rounded-full',
															inst.status === 'paid'
																? 'bg-secondary text-foreground/80'
																: 'bg-secondary text-muted-foreground',
														)}
													>
														{#if inst.status === 'paid'}
															<Check class="h-3 w-3" />
														{:else}
															<Clock class="h-3 w-3" />
														{/if}
													</span>
													<span class="font-mono text-[10px] text-muted-foreground">
														{fmtDateFr(inst.date)}
													</span>
												</div>
												<span
													class={cn(
														'font-mono tabular-nums',
														inst.status === 'paid' ? 'text-foreground' : 'text-muted-foreground',
													)}
												>
													{inst.amount.toLocaleString('fr-FR')} €
												</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{:else if tab === 'bulletin'}
		<StudentReportCardPanel {s} />
	{/if}
</div>
