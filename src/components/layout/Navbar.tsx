"use client";

import Link from "next/link";
import { GitMerge, ChevronDown, LogOut, Wallet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NetworkBadge } from "@/components/ui/NetworkBadge";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { messages, t } from "@/lib/messages";
import type { UserRole } from "@/types";

const links = [
  { href: "/issues", label: messages["nav.bounties"] },
  { href: "/milestones", label: messages["nav.milestones"] },
];

/** Dashboard landing route per role. */
const dashboardRoute: Record<UserRole, string> = {
  contributor: "/dashboard/contributor",
  maintainer: "/dashboard/maintainer",
  sponsor: "/dashboard/sponsor",
};

/**
 * Display order for a multi-role account. `AuthUser.roles` is an array and a
 * maintainer who also sponsors really does hold both; the order here only
 * decides which one is listed first, never which ones are listed.
 */
const roleOrder: readonly UserRole[] = ["maintainer", "sponsor", "contributor"];

const roleLabel: Record<UserRole, string> = {
  contributor: messages["nav.role.contributor"],
  maintainer: messages["nav.role.maintainer"],
  sponsor: messages["nav.role.sponsor"],
};

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const { address, linkState, initializing } = useWallet();

  // A user can hold any subset of roles, so derive the menu from the array
  // rather than assuming one role. Unknown/duplicated entries are dropped
  // rather than trusted: `roles` arrives from the backend unvalidated.
  const roles = Array.from(new Set(user?.roles ?? [])).filter(
    (role): role is UserRole => role in dashboardRoute,
  );
  const orderedRoles = roleOrder.filter((role) => roles.includes(role));

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <GitMerge className="h-4 w-4" />
            </span>
            MergeFi
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400 md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-900 dark:hover:text-white">
                {link.label}
              </Link>
            ))}
            <div className="group relative">
              <button
                aria-haspopup="menu"
                // A multi-role account gets an explicit explanation rather
                // than a menu that silently happens to contain two entries.
                title={
                  orderedRoles.length > 1
                    ? t("nav.roles.multiLabel", { count: orderedRoles.length })
                    : messages["nav.dashboards"]
                }
                className="flex items-center gap-1 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:text-white"
              >
                {messages["nav.dashboards"]}
                {orderedRoles.length > 1 && (
                  <span className="rounded-full bg-indigo-50 px-1.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                    {orderedRoles.length}
                  </span>
                )}
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
              {/* group-focus-within alongside group-hover: the submenu was
                  only reachable via mouse hover — a keyboard user tabbing
                  to the trigger never made it visible, and the links
                  inside stayed in the tab order (invisible/opacity-0, not
                  display: none) so focus could land on an invisible link
                  (#222). focus-within keeps it open while focus is
                  anywhere inside this wrapper, including on the links
                  themselves. */}
              <div className="invisible absolute start-0 top-full pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
                  {orderedRoles.length > 0 ? (
                    orderedRoles.map((role) => (
                      <Link
                        key={role}
                        href={dashboardRoute[role]}
                        className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        {roleLabel[role]}
                      </Link>
                    ))
                  ) : (
                    /* Signed in but no role assigned yet. Every dashboard is
                       real and browsable — they are not authorization-gated —
                       so this explains the absence rather than pretending
                       there is nothing to see. */
                    <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                      {messages["nav.roles.none"]}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {!loading && user && (
              <Link href={`/reputation/${user.username}`} className="hover:text-slate-900 dark:hover:text-white">
                {messages["nav.reputation"]}
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBadge />
          <ThemeToggle />
          {loading ? (
            /* Neutral pending state. Rendering the logged-out CTAs here is
               what produced the "Connect GitHub flashes, then flips to the
               account" bug: AuthContext starts `loading: true` and resolves a
               tick later, so every signed-in visitor saw the signed-out UI
               first. A skeleton reserves the same width so the header does
               not jump when the real content lands either. */
            <div
              data-testid="navbar-session-skeleton"
              aria-busy="true"
              aria-label={messages["nav.resolvingSession"]}
              className="flex h-8 w-32 animate-pulse items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800"
            />
          ) : user ? (
            <div className="flex items-center gap-3">
              <WalletIndicator
                linkState={linkState}
                address={address}
                initializing={initializing}
              />
              <Link
                href={`/reputation/${user.username}`}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                <Avatar seed={user.username} src={user.avatarUrl ?? undefined} size={28} />
                {user.displayName ?? user.username}
              </Link>
              <button
                onClick={logout}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title={messages["nav.signOut"]}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <Link href="/connect">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  {messages["nav.signIn"]}
                </Button>
              </Link>
              <Link href="/connect">
                <Button size="sm">{messages["nav.connectGitHub"]}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Compact wallet status, so a Freighter/account drift is visible in the chrome
 * instead of only surfacing as a blocking error at the moment the user tries
 * to fund something. `local` — connected in the browser but never saved to
 * the profile — is deliberately styled as a warning: payouts cannot reach
 * that address, and a plain green tick would imply they can.
 */
function WalletIndicator({
  linkState,
  address,
  initializing,
}: {
  linkState: "none" | "local" | "linked";
  address: string | null;
  initializing: boolean;
}) {
  if (initializing) {
    return (
      <span
        data-testid="navbar-wallet-skeleton"
        aria-hidden="true"
        className="h-8 w-8 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800"
      />
    );
  }

  if (linkState === "none") {
    return (
      <Link
        href="/connect"
        title={messages["nav.wallet.needsGitHub"]}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Wallet className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{messages["nav.wallet.needsGitHub"]}</span>
      </Link>
    );
  }

  const linked = linkState === "linked";
  return (
    <Link
      href="/connect"
      title={
        linked && address
          ? `${messages["nav.wallet.connected"]} — ${shortAddress(address)}`
          : messages["nav.wallet.notLinked"]
      }
      className={
        linked
          ? "flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          : "flex h-8 items-center gap-1.5 rounded-full bg-amber-50 px-2 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
      }
    >
      {linked ? (
        <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {address && <span className="font-mono">{shortAddress(address)}</span>}
      <span className="sr-only">
        {linked ? messages["nav.wallet.connected"] : messages["nav.wallet.notLinked"]}
      </span>
    </Link>
  );
}
