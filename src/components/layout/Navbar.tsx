"use client";

import Link from "next/link";
import { GitMerge, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NetworkBadge } from "@/components/ui/NetworkBadge";
import { useAuth } from "@/context/AuthContext";

const links = [
  { href: "/issues", label: "Bounties" },
  { href: "/milestones", label: "Milestones" },
];

const dashboardLinks = [
  { href: "/dashboard/contributor", label: "Contributor" },
  { href: "/dashboard/maintainer", label: "Maintainer" },
  { href: "/dashboard/sponsor", label: "Sponsor" },
];

export function Navbar() {
  const { user, loading, logout } = useAuth();

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
                className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Dashboards
                <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {/* group-focus-within alongside group-hover: the submenu was
                  only reachable via mouse hover — a keyboard user tabbing
                  to the trigger never made it visible, and the links
                  inside stayed in the tab order (invisible/opacity-0, not
                  display: none) so focus could land on an invisible link
                  (#222). focus-within keeps it open while focus is
                  anywhere inside this wrapper, including on the links
                  themselves. */}
              <div className="invisible absolute left-0 top-full pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
                  {dashboardLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            {user && (
              <Link href={`/reputation/${user.username}`} className="hover:text-slate-900 dark:hover:text-white">
                Reputation
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBadge />
          <ThemeToggle />
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <Link
                href={`/reputation/${user.username}`}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                <Avatar seed={user.username} src={user.avatarUrl ?? undefined} size={28} />
                {user.displayName ?? user.username}
              </Link>
              <button
                onClick={logout}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <Link href="/connect">
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                  Sign in
                </Button>
              </Link>
              <Link href="/connect">
                <Button size="sm">Connect GitHub</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
