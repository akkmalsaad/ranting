import Link from "next/link";
import { ArrowLeft, Building2, Check, ChevronRight, Circle, ClipboardList, Download, Lock, Receipt, SlidersHorizontal, Wallet, type LucideIcon } from "lucide-react";
import { clubClient, requireClub } from "@/lib/clubs";
import { listBeltLevels } from "@/lib/belt-levels";
import { loadClubCategories, loadClubSettings } from "@/lib/club-settings";
import { PAYMENT_METHODS } from "@/lib/fees/values";
import { formatMYR } from "@/lib/finance/values";
import { formatDate } from "@/lib/format";
import { ordinal } from "@/lib/settings-values";
import { MAX_REGISTRATION_CHILDREN, todayInMalaysia } from "@/lib/validation";
import { BeltLevelsSettings } from "@/components/settings/belt-levels-settings";
import { SettingsCard, SettingsFacts, SettingsNote } from "@/components/settings/settings-card";
import { FeeDefaultsDialog, PaymentMethodsDialog } from "@/components/settings/fee-settings";
import { ManageCategoriesDialog } from "@/components/settings/category-settings";
import { RegistrationLinkButton } from "@/components/settings/registration-link-button";
import { PageHeader } from "@/components/page-header";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ClubSettingsForm } from "@/components/clubs/club-profile-form";
import { ClubLogo, clubLogoSrc } from "@/components/clubs/club-logo";
import { profileChecklist } from "@/components/clubs/profile-completion";
import { cn } from "@/lib/utils";
import { updateClubSettings } from "./actions";

export const metadata = { title: "Settings" };

type Section = "club" | "fees" | "finance" | "registration" | "system";
const SECTIONS: { key: Section; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "club", label: "Club", hint: "Profile and belt levels", icon: Building2 },
  { key: "fees", label: "Fees & Payments", hint: "Monthly defaults and methods", icon: Receipt },
  { key: "finance", label: "Finance", hint: "Income and expense categories", icon: Wallet },
  { key: "registration", label: "Registration", hint: "Parent registration", icon: ClipboardList },
  { key: "system", label: "System", hint: "Region and data export", icon: SlidersHorizontal },
];
/** Club sub-views (edited in place, reached from the Club summary). "details" is the old URL. */
const CLUB_VIEWS = ["club-details", "belt-levels", "details"];

const NOTICES = {
  saved: "Club details saved.",
  "belt-created": "Belt level added.",
  "belt-updated": "Belt level updated.",
  "fees-saved": "Monthly fee defaults saved.",
  "methods-saved": "Payment methods saved.",
};
const NEEDS_UPDATE = "This setting will be available after the next database update. Until then Ranting uses its standard behaviour.";

/**
 * Settings: five sections (Club, Fees & Payments, Finance, Registration, System), each a few
 * read-only summary cards with one edit action. Desktop shows a light section list beside the
 * content; phones show the list on its own, then the chosen section with a back link.
 */
export default async function Settings({ params, searchParams }: PageProps<"/clubs/[clubId]/settings">) {
  const { clubId } = await params;
  const sp = await searchParams;
  const raw = typeof sp.section === "string" ? sp.section : "";
  const view = CLUB_VIEWS.includes(raw) ? (raw === "details" ? "club-details" : raw) : "";
  const section: Section = view ? "club" : SECTIONS.find((s) => s.key === raw)?.key ?? "club";
  // Phones show the section list until a section is chosen (any `section`, or a notice after saving).
  const chosen = !!raw || typeof sp.notice === "string";
  const base = `/clubs/${clubId}/settings`;
  const href = (key: string) => `${base}?section=${key}`;
  const { club } = await requireClub(clubId);

  let content: React.ReactNode;
  if (view === "club-details") {
    content = <>
      <section aria-labelledby="club-details-title" className="panel">
        <h2 id="club-details-title">Club details</h2>
        <p className="mb-6 mt-0.5 text-[0.8125rem] text-slate-500">Name and style are required; everything else is optional.</p>
        <ClubSettingsForm action={updateClubSettings.bind(null, club.id)} club={club} logoSrc={clubLogoSrc(club)} />
      </section>
    </>;
  } else if (view === "belt-levels") {
    const { db } = await clubClient(clubId);
    content = <>
      <BeltLevelsSettings clubId={club.id} levels={await listBeltLevels(db, clubId)} />
    </>;
  } else if (section === "club") {
    const { db } = await clubClient(clubId);
    const levels = (await listBeltLevels(db, clubId)).filter((l) => !l.archived_at);
    const checklist = profileChecklist(club);
    const completed = checklist.filter((i) => i.done).length;
    const address = [club.address_line1, club.address_line2, [club.postcode, club.city].filter(Boolean).join(" "), club.state].filter(Boolean).join(", ");
    content = <>
      <SettingsCard id="club-profile" title="Club profile" action={<Link href={href("club-details")} className={buttonVariants({ variant: "outline", size: "sm" })}>Edit details</Link>}>
        <div className="flex items-center gap-4">
          <ClubLogo club={club} className="size-14 shrink-0 rounded-2xl border border-border bg-white object-cover" />
          <div className="min-w-0">
            <p className="break-words text-base font-semibold">{club.name}</p>
            <p className="mt-0.5 text-sm text-slate-500">{club.discipline}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <SettingsFacts items={[["Phone", club.phone], ["Email", club.email], ["Address", address || null]]} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
          <p><span className="font-semibold">Profile {completed === checklist.length ? "complete" : `${completed} of ${checklist.length} complete`}</span> <span className="text-slate-500">· Optional details</span></p>
          <span aria-hidden className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(completed / checklist.length) * 100}%` }} /></span>
          {completed < checklist.length && (
            <ul className="flex w-full flex-wrap gap-x-5 gap-y-2">
              {checklist.map(({ label, done }) => <li key={label} className="flex items-center gap-1.5 text-xs text-slate-600">{done ? <Check size={14} aria-hidden className="text-primary" /> : <Circle size={12} aria-hidden />}<span>{label}<span className="sr-only">{done ? ": complete" : ": missing"}</span></span></li>)}
            </ul>
          )}
        </div>
      </SettingsCard>
      <SettingsCard id="belt-levels-summary" title="Belt levels" description="Your club's belt or rank progression, shared by all branches." action={<Link href={href("belt-levels")} className={buttonVariants({ variant: "outline", size: "sm" })}>Manage belt levels</Link>}>
        {/* Text only: the belt visuals live on the Belt levels screen itself. */}
        {levels.length ? (
          <p className="break-words text-sm">
            <span className="font-semibold">{levels.length} active {levels.length === 1 ? "level" : "levels"}</span>
            <span className="text-slate-500"> · {levels.length === 1 ? levels[0].name : `${levels[0].name} to ${levels[levels.length - 1].name}`}</span>
          </p>
        ) : <p className="text-sm text-slate-600">No active belt levels</p>}
      </SettingsCard>
    </>;
  } else if (section === "fees") {
    const settings = await loadClubSettings(clubId);
    content = <>
      <SettingsCard id="fee-defaults" title="Monthly fee defaults" description="Prefill Generate monthly fees. Existing fees are never changed." action={settings.available && <FeeDefaultsDialog clubId={club.id} amountSen={settings.monthlyFeeSen} dueDay={settings.dueDay} />}>
        {settings.monthlyFeeSen || settings.dueDay ? (
          <p className="text-[0.9375rem]">
            <span className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{settings.monthlyFeeSen ? formatMYR(settings.monthlyFeeSen) : "No default amount"}</span>
            <span className="text-slate-500"> · {settings.dueDay ? `Due on the ${ordinal(settings.dueDay)} of each month` : "No default due day"}</span>
          </p>
        ) : <p className="text-sm text-slate-600">No defaults yet. Generate monthly fees starts with a blank amount and the 1st of the month.</p>}
        {!settings.available && <SettingsNote>{NEEDS_UPDATE}</SettingsNote>}
      </SettingsCard>
      <SettingsCard id="payment-methods" title="Payment methods" description="Offered when you record a fee payment." action={settings.available && <PaymentMethodsDialog clubId={club.id} methods={settings.paymentMethods} />}>
        <ul className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.filter((m) => settings.paymentMethods.includes(m.value)).map((m) => <li key={m.value}><Badge tone="success" icon={Check}>{m.label}</Badge></li>)}
        </ul>
        {!settings.available && <SettingsNote>{NEEDS_UPDATE} DuitNow QR will be added then.</SettingsNote>}
      </SettingsCard>
    </>;
  } else if (section === "finance") {
    const { available, categories } = await loadClubCategories(clubId);
    content = (
      <SettingsCard id="finance-categories" title="Finance categories" description="How income and expenses are grouped in Finance." action={available && <ManageCategoriesDialog clubId={club.id} categories={categories} />}>
        <div className="space-y-4">
          {(["income", "expense"] as const).map((kind) => {
            const active = categories[kind].filter((c) => !c.archived);
            const archived = categories[kind].length - active.length;
            return (
              <div key={kind}>
                <p className="text-[0.8125rem] font-semibold text-slate-500">{kind === "income" ? "Income" : "Expenses"}</p>
                <p className="mt-1 text-sm leading-6">{active.map((c) => c.label).join(" · ")}</p>
                {archived > 0 && <p className="text-xs text-slate-500">{archived} archived</p>}
              </div>
            );
          })}
        </div>
        {!available && <SettingsNote>{NEEDS_UPDATE} Until then these standard categories are used and can&apos;t be changed.</SettingsNote>}
      </SettingsCard>
    );
  } else if (section === "registration") {
    const { db } = await clubClient(clubId);
    const [branches, pending] = await Promise.all([
      db.from("branches").select("id, name").eq("club_id", clubId).is("archived_at", null).order("name").limit(200),
      db.from("student_applications").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
    ]);
    content = <>
      <SettingsCard id="registration-workflow" title="Parent registration" description="How registrations from your shared links are handled.">
        <ul className="divide-y divide-border">
          <FixedSetting title="New registrations require approval" body="Every registration waits for your review before a student is added. Automatic approval isn't available." />
          <FixedSetting title="Parents can add multiple children" body={`Parents can register up to ${MAX_REGISTRATION_CHILDREN} children in one submission, sharing one guardian contact.`} />
        </ul>
      </SettingsCard>
      <SettingsCard
        id="registration-links"
        title="Registration links"
        description="Each branch has its own link to share by WhatsApp, copy or QR code."
        action={<>
          {!branches.error && branches.data.length > 0 && <RegistrationLinkButton clubId={club.id} clubName={club.name} branches={branches.data} />}
          <Link href={`/clubs/${club.id}/registrations`} className={buttonVariants({ variant: "ghost", size: "sm" })}>Review registrations</Link>
        </>}
      >
        <p className="text-sm text-slate-600">
          {pending.error ? "Registrations awaiting review are listed under Review registrations."
            : pending.count ? <><span className="font-semibold text-foreground">{pending.count}</span> {pending.count === 1 ? "registration is" : "registrations are"} waiting for review.</>
            : "No registrations are waiting for review."}
          {!branches.error && branches.data.length === 0 && <> Add a branch first: <Link href={`/clubs/${club.id}/branches`} className="font-semibold text-primary hover:underline">Branches</Link>.</>}
        </p>
      </SettingsCard>
    </>;
  } else {
    const exports = [
      { key: "students", label: "Students", hint: "Every student, including archived" },
      { key: "finance", label: "Finance records", hint: "All income and expenses" },
      { key: "fees", label: "Fee records", hint: "Every fee with paid and balance" },
    ];
    content = <>
      <SettingsCard id="language-region" title="Language & region" description="Ranting is set up for Malaysian clubs.">
        <SettingsFacts items={[
          ["Language", "English"],
          ["Currency", "MYR – Malaysian Ringgit"],
          ["Timezone", "Malaysia time (GMT+8)"],
          ["Date format", `Day month year · ${formatDate(todayInMalaysia())}`],
        ]} />
      </SettingsCard>
      <SettingsCard id="data-export" title="Data export" description="Download a copy of your club records as CSV files (opens in Excel or Google Sheets).">
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {exports.map((e) => (
            <li key={e.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0"><span className="block text-sm font-semibold">{e.label}</span><span className="block text-xs text-slate-500">{e.hint}</span></span>
              {/* Plain link: the route returns a file download, not a page. */}
              <a href={`/clubs/${club.id}/export/${e.key}`} download className={buttonVariants({ variant: "outline", size: "sm" })}><Download size={15} aria-hidden /> Export CSV</a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Files contain personal details of students and guardians. Store and share them carefully.</p>
      </SettingsCard>
    </>;
  }

  return (
    <>
      <PageHeader title="Settings" description="Manage how your club works in Ranting." />
      <Notice code={sp.notice} messages={NOTICES} />

      {/* Phones: the section list on its own until one is chosen. */}
      {!chosen && (
        <nav aria-label="Settings sections" className="lg:hidden">
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
            {SECTIONS.map(({ key, label, hint, icon: Icon }) => (
              <li key={key}>
                <Link href={href(key)} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Icon size={18} strokeWidth={1.75} aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-semibold">{label}</span><span className="block text-xs text-slate-500">{hint}</span></span>
                  <ChevronRight size={18} aria-hidden className="shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className={cn("grid items-start gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]", !chosen && "hidden lg:grid")}>
        <nav aria-label="Settings sections" className="sticky top-6 hidden lg:block">
          <ul className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <Link href={href(key)} aria-current={section === key ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200", section === key ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_#071e301f] ring-1 ring-border" : "font-medium text-slate-600 hover:bg-white/70 hover:text-foreground")}>
                  <Icon size={17} strokeWidth={1.75} aria-hidden className="shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Keyed so a newly chosen section eases in (the same motion as page changes). */}
        <div key={view || section} className="page-enter min-w-0 max-w-3xl space-y-6">
          {/* Back: from a Club sub-view to Club (all sizes); from a section to the list (phones). */}
          {view
            ? <BackLink href={href("club")} label="Club" />
            : <BackLink href={base} label="Settings" className="lg:hidden" />}
          {!view && <SectionTitle section={SECTIONS.find((s) => s.key === section)!} />}
          {content}
        </div>
      </div>
    </>
  );
}

function SectionTitle({ section }: { section: (typeof SECTIONS)[number] }) {
  const descriptions: Record<Section, string> = {
    club: "Manage your club information and student progression system.",
    fees: "Defaults for charging members and recording their payments.",
    finance: "Organise how income and expenses are grouped.",
    registration: "How parent registration works for your club.",
    system: "Regional settings and copies of your records.",
  };
  return (
    <div>
      <p className="text-xl font-bold tracking-[-0.02em]">{section.label}</p>
      <p className="mt-0.5 text-sm text-slate-500">{descriptions[section.key]}</p>
    </div>
  );
}

function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return <Link href={href} className={cn("inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-foreground", className)}><ArrowLeft size={16} aria-hidden /> {label}</Link>;
}

/** A workflow rule that is always on today: shown as on, with why it can't be changed. */
function FixedSetting({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-[0.8125rem] text-slate-500">{body}</span></span>
      <Badge tone="success" icon={Lock} className="mt-0.5 shrink-0">Always on</Badge>
    </li>
  );
}
