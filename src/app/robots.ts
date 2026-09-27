import type { MetadataRoute } from "next";
import { sitemapUrls } from "@/lib/sitemap";

/**
 * robots.txt — the third surface that has to agree with the indexability
 * policy in src/lib/seo-policy.ts (the other two being the sitemap and the
 * per-page `robots` metadata on /reputation/[handle]).
 *
 * Note what is deliberately NOT here: no `Disallow: /reputation/`. Profiles
 * are public and linkable; the ones that haven't opted into indexing carry
 * `noindex, nofollow` in their own page metadata. Blocking them in robots.txt
 * would prevent crawlers from ever fetching the page, which means they would
 * never see that noindex tag — leaving already-indexed URLs in the index
 * indefinitely. Letting crawlers read the page is what makes de-indexing work.
 *
 * Dashboard/auth routes stay disallowed: they are per-user surfaces with no
 * value in a search index, and /auth/callback carries a short-lived token in
 * its query string.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/auth/callback"],
    },
    // One entry per generated child sitemap, so this stays correct as the
    // entry count grows past a single 50,000-URL file.
    sitemap: await sitemapUrls(),
  };
}
