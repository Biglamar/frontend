import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Users,
  BarChart3,
  GitPullRequest,
  Wallet,
  ArrowRight,
  Trophy,
  Code2,
  KeyRound,
  Coins,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { ActivityList } from "@/components/dashboard/ActivityList";
import {
  platformStats,
  trustedOrgs,
  topContributors,
  recentActivity,
  faqs,
} from "@/lib/mock-data";
import { formatCurrency, formatInteger } from "@/lib/utils";
import { STELLAR_NETWORK } from "@/lib/config";

const integrations = [
  { icon: Code2, label: "GitHub" },
  { icon: Zap, label: "Soroban" },
  { icon: KeyRound, label: "Freighter" },
  { icon: Coins, label: "USDC / XLM" },
];

const journey = [
  "Maintainer connects a GitHub repository.",
  "Issue #42 is marked with a 100 USDC reward.",
  "A sponsor funds the bounty, and funds lock into a Soroban escrow contract.",
  "A contributor claims the issue and opens a pull request.",
  "The maintainer reviews and merges it.",
  "MergeFi detects the merge via GitHub webhook.",
  "The escrow contract automatically releases payment to the contributor.",
  "The contributor's reputation and earnings profile update instantly.",
];

const features = [
  {
    icon: GitPullRequest,
    title: "Repository sync",
    description:
      "Connect GitHub and MergeFi imports repositories, issues, pull requests, and contributors automatically.",
  },
  {
    icon: ShieldCheck,
    title: "Smart escrow",
    description:
      "Funds move into a Soroban smart contract the moment a bounty is funded. No one can withdraw until the work is verified.",
  },
  {
    icon: Zap,
    title: "Instant payouts",
    description:
      "Merges are detected via GitHub webhooks and trigger automatic on-chain payment release in seconds.",
  },
  {
    icon: Users,
    title: "Team bounties",
    description:
      "Split rewards across multiple contributors by role, like frontend, backend, and testing, paid out automatically.",
  },
  {
    icon: BarChart3,
    title: "Reputation & analytics",
    description:
      "Build a financial contribution profile: lifetime earnings, merge rate, review time, and top clients.",
  },
  {
    icon: Wallet,
    title: "Sponsor dashboards",
    description:
      "Track spending, active bounties, contributor performance, and budget remaining in real time.",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="bg-hero-gradient bg-grid border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {STELLAR_NETWORK === "PUBLIC" ? "Built for Stellar Mainnet" : "Built for Stellar (Testnet)"}
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
            Merge code.
            <br />
            <span className="text-gradient">Earn instantly.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            MergeFi is the financial infrastructure for open source. Sponsors
            fund issues, contributors get paid the moment their pull request
            is merged, and Soroban smart contracts on Stellar handle the
            escrow.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/issues">
              <Button size="lg" className="gap-2">
                Browse paid issues <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <Link href="/connect">
              <Button size="lg" variant="outline">
                Sponsor a repository
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <AvatarStack seeds={topContributors.map((c) => c.handle)} />
            <span>
              Joined by{" "}
              <strong className="text-slate-900 dark:text-white">
                {formatInteger(platformStats.activeContributors)} contributors
              </strong>{" "}
              already earning
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Trusted by open-source teams on Stellar
          </p>
          <ul role="list" className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {trustedOrgs.map((org) => (
              <li key={org} className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                <Avatar seed={org} size={20} className="rounded-md" />
                {org}
              </li>
            ))}
          </ul>
          <ul role="list" className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-t border-slate-100 pt-6 dark:border-slate-800">
            {integrations.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Total paid out"
            value={platformStats.totalPaidOut}
            format="currency"
          />
          <StatCard
            label="Bounties completed"
            value={platformStats.bountiesCompleted}
            format="count"
          />
          <StatCard
            label="Active contributors"
            value={platformStats.activeContributors}
            format="count"
          />
          {/* Avg. payout time is a duration (minutes), not a currency/count/percent —
              no existing StatCardFormat covers it, so keep as pre-formatted string. */}
          <StatCard
            label="Avg. payout time"
            value={`${platformStats.avgPayoutTimeMinutes} min`}
          />
        </section>

        <section className="mt-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Platform
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
              Everything you need to fund and get paid for open source
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="transition-shadow hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                  <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-medium text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <Card padding="xl">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              A typical bounty, start to finish
            </h2>
            <ol className="mt-8 space-y-4">
              {journey.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-medium text-indigo-600 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-slate-600 dark:text-slate-300">{step}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card padding="xl">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Top contributors this month
              </h2>
            </div>
            <ul className="mt-6 space-y-1">
              {topContributors.map((c, i) => (
                <li key={c.handle}>
                  <Link
                    href={`/reputation/${c.handle}`}
                    className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-sm font-medium text-slate-400 dark:text-slate-500">
                        {i + 1}
                      </span>
                      <Avatar seed={c.handle} size={32} />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          @{c.handle}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {c.mergedPRs} merged PRs · {c.topLanguage}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(c.earnings)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-24">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" aria-hidden="true" />
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Live on the platform
            </h2>
          </div>
          <div className="mt-6">
            <ActivityList events={recentActivity} />
          </div>
        </section>

        <section className="mt-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              FAQ
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
              Common questions
            </h2>
          </div>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <summary className="cursor-pointer list-none font-medium text-slate-900 marker:content-none dark:text-white">
                  <span className="flex items-center justify-between">
                    {faq.question}
                    <span aria-hidden="true" className="ms-4 text-slate-400 transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-spice-gradient mt-24 overflow-hidden rounded-2xl border border-slate-200 px-8 py-14 text-center dark:border-slate-800">
          <h2 className="text-3xl font-semibold text-white">
            Why Stellar and Soroban?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Very low transaction costs make micro-bounties practical, fast
            settlement means contributors aren&apos;t waiting days for
            payment, and Soroban smart contracts handle escrow, splits, and
            milestone payouts natively on-chain.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/issues">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Get started
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
