import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchReputationByUsername } from "@/lib/api";
import { mockReputationProfiles } from "@/lib/mock-data";
import { profileIsIndexable } from "@/lib/seo-policy";
import { ReputationProfileView } from "./ReputationProfileView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const mockFallback =
    Object.values(mockReputationProfiles).find(
      (p) => p.handle.toLowerCase() === handle.toLowerCase(),
    ) ?? null;
  const { data: profile } = await fetchReputationByUsername(handle, mockFallback);

  if (!profile) {
    return { title: "Profile not found | MergeFi" };
  }

  const title = `@${profile.handle} | MergeFi`;
  const description = `${profile.mergedPRs} merged PRs · ${profile.languages.slice(0, 3).join(", ")}`;

  return {
    title,
    description,
    // The noindex fallback required by the policy in src/lib/seo-policy.ts.
    // Omitting a profile from the sitemap is not sufficient on its own: a URL
    // that has already been crawled (shared in a Slack channel, a GitHub
    // profile README, a search result from before the policy existed) can
    // still get indexed from an inbound link, and robots.txt can't express
    // "this one page is private, the rest aren't". So every profile that
    // hasn't opted in states it explicitly in the document head.
    //
    // Deliberately not an X-Robots-Tag header: a header can only be set for a
    // whole route match in next.config.ts, which would noindex opted-in
    // profiles too. Per-page metadata is the granularity this policy needs.
    //
    // A static header for all /reputation/* was also rejected for the same
    // reason — see the robots.ts comment for why robots.txt must not
    // disallow this path either.
    robots: profileIsIndexable(profile)
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: `/reputation/${handle}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const mockFallback =
    Object.values(mockReputationProfiles).find(
      (p) => p.handle.toLowerCase() === handle.toLowerCase(),
    ) ?? null;
  const { data: profile } = await fetchReputationByUsername(handle, mockFallback);

  if (!profile) notFound();

  return <ReputationProfileView profile={profile} />;
}
