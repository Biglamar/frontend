import { getSitemapChunks, SITEMAP_CACHE_TTL_MS, type SitemapEntry } from "@/lib/sitemap";

/**
 * Chunked sitemap route: /sitemaps/<id>.xml
 *
 * Previously a single `app/sitemap.ts` listing every bounty, every static
 * route, and — before the indexability policy in src/lib/seo-policy.ts — *every*
 * handle the /users endpoint returned, in one file. Search engines cap a
 * sitemap at 50,000 URLs / 50MB, so that design had nowhere to grow: past the
 * limit the file is silently ignored and the whole site drops out of the index.
 *
 * This is a plain Route Handler rather than Next's `sitemap/[id]` metadata
 * route convention for one concrete reason: Next 16.3.5's own generated type
 * validator rejects that convention. The validator requires a route handler
 * module to share a property with `RouteHandlerConfig` (which allows only
 * HTTP-method exports), while the metadata route's `app/sitemap/[id]/route.ts`
 * exports only `default` and `generateSitemaps` — so `next build` fails with
 * TS2559. Writing the XML here avoids that and gives explicit control over the
 * response headers.
 *
 * robots.txt advertises one entry per chunk (see src/app/robots.ts), which is
 * the standard discovery mechanism — a separate sitemap *index* file is
 * optional, and the 301 in next.config.ts keeps the old /sitemap.xml working.
 */
const CACHE_CONTROL =
  `public, s-maxage=${Math.floor(SITEMAP_CACHE_TTL_MS / 1000)}, ` +
  "stale-while-revalidate=86400";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrlset(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url>\n` +
        `    <loc>${escapeXml(entry.url)}</loc>\n` +
        (entry.lastModified
          ? `    <lastmod>${entry.lastModified.toISOString()}</lastmod>\n`
          : "") +
        (entry.changeFrequency
          ? `    <changefreq>${entry.changeFrequency}</changefreq>\n`
          : "") +
        (entry.priority === undefined ? "" : `    <priority>${entry.priority}</priority>\n`) +
        `  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  // The dynamic segment captures the whole filename, so `/sitemaps/0.xml`
  // arrives as "0.xml". Accept the suffix either way so both spellings work.
  const index = Number(id.replace(/\.xml$/, ""));
  const chunks = await getSitemapChunks();

  // An id outside the current range 404s rather than serving someone else's
  // chunk, and isn't cacheable — the chunk count can grow.
  if (!Number.isInteger(index) || index < 0 || index >= chunks.length) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return new Response(renderUrlset(chunks[index]), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
