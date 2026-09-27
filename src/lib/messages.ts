/**
 * messages.ts — single source of truth for user-facing English copy that the
 * state-sensitive surfaces depend on.
 *
 * WHY THIS EXISTS
 * ───────────────
 * This app has no translation runtime, so these strings are still English
 * literals. What changed is that they are no longer *scattered* — every
 * string whose value depends on auth/role/wallet/empty state is keyed here
 * next to its siblings, so a future extractor has one file to walk and a
 * future `next-intl` migration is a mechanical `t("key")` swap rather than a
 * rewrite of 80 components.
 *
 * The shape is a flat `Record<string, string>` with typed keys. A real
 * catalog would nest by namespace and carry ICU placeholders; the flat shape
 * is deliberate so adding a locale means adding one sibling object, not
 * restructuring every call site.
 *
 * NOT IN SCOPE: actually translating these. Shipping a second language needs
 * a product decision about which languages, and a half-done translation
 * surface is worse than none.
 */

/** English copy, keyed by a stable dotted id. */
export const messages = {
  // ─── Navigation ───────────────────────────────────────────────────────
  "nav.bounties": "Bounties",
  "nav.milestones": "Milestones",
  "nav.dashboards": "Dashboards",
  "nav.reputation": "Reputation",
  "nav.signIn": "Sign in",
  "nav.connectGitHub": "Connect GitHub",
  "nav.signOut": "Sign out",
  "nav.resolvingSession": "Restoring your session",
  "nav.wallet.connected": "Wallet connected",
  "nav.wallet.notLinked": "Wallet not linked to your account",
  "nav.wallet.needsGitHub": "Link a wallet",
  "nav.roles.none": "No dashboard assigned yet",
  "nav.roles.multiLabel": "You have {count} roles — pick a dashboard",
  "nav.role.contributor": "Contributor",
  "nav.role.maintainer": "Maintainer",
  "nav.role.sponsor": "Sponsor",

  // ─── Connect flow ─────────────────────────────────────────────────────
  "connect.eyebrow": "Get started",
  "connect.title": "Connect your accounts",
  "connect.intro":
    "MergeFi needs GitHub to sync your repositories and a Stellar wallet to send or receive bounty payments.",
  "connect.github.name": "GitHub",
  "connect.github.description": "Sync repositories, issues, and pull requests.",
  "connect.github.cta": "Continue with GitHub",
  "connect.github.signedIn": "Signed in as @{username}",
  "connect.github.checking": "Checking your GitHub session…",
  "connect.wallet.name": "Stellar wallet",
  "connect.wallet.description": "Freighter is used to sign escrow and payout transactions.",
  "connect.wallet.cta": "Connect Freighter",
  "connect.wallet.connecting": "Connecting…",
  "connect.wallet.checking": "Checking your wallet…",
  "connect.wallet.linked": "Payout wallet: {address} ({network})",
  "connect.wallet.localOnlyTitle": "Connected, but not linked to your account",
  "connect.wallet.localOnlyBody":
    "Freighter granted access, but this address was never saved to your MergeFi profile, so payouts cannot reach it. Link it before you fund or claim a bounty.",
  "connect.wallet.blockedTitle": "Sign in with GitHub first",
  "connect.wallet.blockedBody":
    "A wallet has to be linked to a MergeFi account, so link your wallet after GitHub sign-in. This keeps the payout address on your profile and stops a connection from being lost when you sign in.",
  "connect.wallet.mismatchTitle": "Wallet address mismatch",
  "connect.wallet.mismatchBody":
    "The connected wallet ({address}) differs from the payout address on file ({onFile}). Payouts are sent to the address on file until you reconnect.",
  "connect.wallet.disconnect": "Disconnect wallet",
  "connect.completeTitle": "You're connected",
  "connect.completeBody": "GitHub and your payout wallet are both linked. You're ready to fund or claim bounties.",
  "connect.progressLabel": "Connection checklist",
  "connect.step.github": "GitHub account",
  "connect.step.wallet": "Payout wallet",
  "connect.step.done": "Done",
  "connect.step.pending": "Not connected",
  "connect.step.needsLinking": "Connected in browser, not linked to your account",

  // ─── Empty states ─────────────────────────────────────────────────────
  "empty.issues.none.title": "No bounties yet",
  "empty.issues.none.description":
    "Check back soon — funded issues appear here once sponsors lock them in escrow.",
  "empty.issues.none.cta": "Fund a bounty",
  "empty.issues.filtered.title": "No bounties match these filters",
  "empty.issues.filtered.description":
    "Every bounty is hidden by the filters you have active. Clear them to see all {total} available.",
  "empty.issues.filtered.cta": "Clear filters",
  "empty.milestones.none.title": "No milestones yet",
  "empty.milestones.none.description":
    "Milestones fund a whole release at once. Sponsors create them once a batch of issues shares a target.",
  "empty.milestones.none.cta": "Fund a milestone",
  "empty.pools.none.title": "No maintenance pools yet",
  "empty.pools.none.description":
    "Maintenance pools pay for ongoing upkeep — dependency bumps, docs, cleanup — that would otherwise go unfunded between releases.",
  "empty.pools.none.cta": "Set up a pool",
  "empty.review.clear.title": "All caught up",
  "empty.review.clear.description":
    "No pull requests are waiting on your review. Everything you've been sent has been merged or paid out.",
  "empty.review.clear.cta": "Review open bounties",
  "empty.sponsor.none.title": "No active bounties",
  "empty.sponsor.none.description":
    "Fund your first bounty to see it here — it's live for contributors the moment the escrow locks.",
  "empty.sponsor.none.cta": "Fund a bounty",
  "empty.sponsor.settled.title": "Every bounty settled",
  "empty.sponsor.settled.description":
    "Nothing is in flight — all the bounties you've funded have been paid out or refunded. Fund another whenever you're ready.",
  "empty.claims.active.title": "No active claims",
  "empty.claims.active.description":
    "You're not working on anything right now. Claim an open bounty to start earning.",
  "empty.claims.active.cta": "Browse open bounties",
  "empty.claims.completed.title": "Nothing completed yet",
  "empty.claims.completed.description":
    "Bounties land here once your pull request is merged and escrow releases the payout.",
  "empty.claims.completed.cta": "Browse open bounties",
  "empty.activity.title": "No activity yet",
  "empty.activity.description":
    "Claims, reviews, and payouts across the platform will show up here as they happen.",
  "empty.reputation.zero.title": "No merged pull requests yet",
  "empty.reputation.zero.description":
    "This profile has no contribution history. A single merged bounty claim is enough to start building a reputation.",
  "empty.reputation.zero.cta": "Browse open bounties",
  "empty.reputation.noOrgs": "No organizations recorded yet.",
  "empty.reputation.noLanguages": "No languages recorded yet.",

  // ─── Data provenance ──────────────────────────────────────────────────
  "data.sample": "Sample data",
  "data.sampleExplainer":
    "Showing sample data because the MergeFi API is unreachable. Figures below are illustrative, not yours.",

  // ─── Deadlines ────────────────────────────────────────────────────────
  "deadline.none": "No deadline",
  "deadline.passed": "Deadline passed",
  "deadline.left": "{count, plural, one {# day} other {# days}} left",
} as const;

/** Every message key, as a union — used to keep `t()` calls honest. */
export type MessageKey = keyof typeof messages;

/**
 * Resolve the plural category for a count in the given locale.
 *
 * `formatDaysUntil` used to hardcode `days === 1 ? "" : "s"`, which is only
 * correct for English — Slovak has four plural categories and Arabic has six.
 * This reads the category from `Intl.PluralRules` so the message template
 * branches correctly the moment a non-English catalog exists.
 */
export function pluralCategory(count: number, locale: string): Intl.LDMLPluralRule {
  try {
    return new Intl.PluralRules(locale).select(count);
  } catch {
    return count === 1 ? "one" : "other";
  }
}

/**
 * Substituted into a plural branch: `{name}` becomes the value, and the ICU
 * `#` shorthand becomes the count itself (so templates stay translatable
 * into languages with a different digit shape).
 */
function fillBranch(branch: string, values: Record<string, string | number>, count: number): string {
  return branch
    .replace(/#/g, String(count))
    .replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? String(values[key]) : match,
    );
}

// Matches the opening of a plural block. Deliberately non-global: this regex
// carries no `lastIndex` state across calls, and there is at most one plural
// block per message. No trailing lookahead — the branch list starts with a
// selector keyword (`one`, `other`, `=0`), not with a brace.
const PLURAL_HEADER = /\{(\w+),\s*plural,\s*/;

/** Where the plural block's branch list starts, and where the block ends. */
function findPluralBlock(
  template: string,
): { start: number; bodyStart: number; end: number } | null {
  const header = PLURAL_HEADER.exec(template);
  if (!header) return null;
  const bodyStart = header.index + header[0].length;

  // Balanced-brace walk rather than a regex: a lookahead heuristic for the
  // block's closing brace mis-nests whenever a branch itself contains braces,
  // silently truncating the final branch and leaking a stray "}" into the
  // output. Counting depth cannot mis-nest.
  let depth = 1;
  let i = bodyStart;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  if (depth !== 0) return null; // Unbalanced template — treat as plain text.
  return { start: header.index, bodyStart, end: i };
}

/**
 * Resolve a message by key: substitutes `{placeholder}` values and evaluates
 * an ICU `plural` block against the viewer's locale. Typed, so a renamed or
 * deleted key is a compile error rather than a runtime "…".
 */
export function t(
  key: MessageKey,
  values: Record<string, string | number> = {},
  locale = "en",
): string {
  const template: string = messages[key];
  const block = findPluralBlock(template);
  if (!block) {
    return fillBranch(template, values, Number(values.count ?? 0));
  }

  const counterName = /^\{(\w+),/.exec(template.slice(block.start))?.[1];
  const count = counterName ? Number(values[counterName] ?? 0) : 0;
  const branches = parsePluralBranches(template.slice(block.bodyStart, block.end));

  // `=N` exact matches win over category matches, per the ICU spec.
  let branch = branches.get(`=${count}`);
  if (branch === undefined) {
    const category = pluralCategory(count, locale);
    branch =
      branches.get(`=${category}`) ?? branches.get(category) ?? branches.get("other") ?? "";
  }

  // Text outside the plural block is real copy and must survive — the
  // "{count, plural, …} left" shape has a meaningful suffix.
  return fillBranch(
    template.slice(0, block.start) + branch + template.slice(block.end + 1),
    values,
    count,
  );
}

/**
 * Parse `one {…} other {…}` pairs out of a plural branch list, brace-counting
 * so a nested block inside a branch is kept intact.
 */
function parsePluralBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>();
  const pattern = /(=\d+|\w+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const selector = match[1];
    const start = pattern.lastIndex;
    let depth = 1;
    let i = start;
    while (i < body.length) {
      const ch = body[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }
    // `i` is the index of the matching close brace, or body.length when the
    // body is malformed — in which case we take the remainder.
    const end = depth === 0 ? i : body.length;
    branches.set(selector, body.slice(start, end));
    pattern.lastIndex = end + 1;
  }
  return branches;
}
