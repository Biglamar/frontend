"use client";

import { GitPullRequest } from "lucide-react";
import Link from "next/link";
import { formatHours } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { messages, t } from "@/lib/messages";
import type { ReputationProfile } from "@/types";

/**
 * A profile with no merged PRs is a real, reachable state — a brand-new
 * contributor, or one who has registered but never claimed a bounty. It used
 * to render as four StatCards each showing "0" / "No activity yet" plus two
 * bare grey spans, with no single consolidated explanation and no way forward.
 */
function isUnproven(profile: ReputationProfile): boolean {
  return profile.mergedPRs === 0 && profile.lifetimeEarnings === 0;
}

export function ReputationProfileView({ profile }: { profile: ReputationProfile }) {
  const unproven = isUnproven(profile);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center gap-4">
        <Avatar seed={profile.handle} src={profile.avatarUrl} size={64} className="rounded-2xl" />
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
            @{profile.handle}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.organizations.map((org) => (
              <Badge key={org}>{org}</Badge>
            ))}
            {profile.organizations.length === 0 && (
              <span className="text-sm text-slate-400 dark:text-slate-500">
                {messages["empty.reputation.noOrgs"]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Lifetime earnings"
          value={profile.lifetimeEarnings}
          format="currency"
          zeroLabel="No earnings yet"
        />
        <StatCard
          label="Merged PRs"
          value={profile.mergedPRs}
          format="count"
          zeroLabel="No merged PRs yet"
        />
        <StatCard
          label="Completion rate"
          value={profile.completionRate}
          format="percent"
          zeroLabel="No completions yet"
        />
        <StatCard
          label="On-time delivery"
          value={profile.onTimeDeliveryRate}
          format="percent"
          zeroLabel="No delivery history yet"
        />
      </div>

      {unproven && (
        <EmptyState
          icon={GitPullRequest}
          tone="info"
          className="mt-8"
          headingLevel="h2"
          title={t("empty.reputation.zero.title")}
          description={t("empty.reputation.zero.description")}
          action={
            <Link
              href="/issues"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {t("empty.reputation.zero.cta")}
            </Link>
          }
        />
      )}

      <div className="mt-8">
        <Card>
          <h2 className="font-medium text-slate-900 dark:text-white">Languages</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.languages.map((lang) => (
              <Badge key={lang}>{lang}</Badge>
            ))}
            {profile.languages.length === 0 && (
              <span className="text-sm text-slate-400 dark:text-slate-500">
                {messages["empty.reputation.noLanguages"]}
              </span>
            )}
          </div>
        </Card>
      </div>

      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        Average review time: {formatHours(profile.avgReviewTimeHours)}
      </p>
    </div>
  );
}
