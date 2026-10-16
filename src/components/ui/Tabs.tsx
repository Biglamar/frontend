"use client";

import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
}) {
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  const focusTab = useCallback(
    (key: T) => {
      tabRefs.current.get(key)?.focus();
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentKey: T) => {
      const keys = tabs.map((t) => t.key);
      const idx = keys.indexOf(currentKey);
      if (idx === -1) return;

      // In a right-to-left tablist the visual order of the tabs is reversed
      // relative to DOM order, so the WAI-ARIA "right arrow moves to the next
      // tab" rule has to be read against what the user can see, not against
      // the array (#456). Without this, ArrowRight jumps to the tab drawn to
      // the *left* in an RTL locale.
      const rtl =
        typeof document !== "undefined" &&
        document.documentElement.getAttribute("dir") === "rtl";

      let nextIdx: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIdx = rtl ? (idx - 1 + keys.length) % keys.length : (idx + 1) % keys.length;
          break;
        case "ArrowLeft":
          nextIdx = rtl ? (idx + 1) % keys.length : (idx - 1 + keys.length) % keys.length;
          break;
        case "Home":
          nextIdx = 0;
          break;
        case "End":
          nextIdx = keys.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextKey = keys[nextIdx];
      onChange(nextKey);
      focusTab(nextKey);
    },
    [tabs, onChange, focusTab],
  );

  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.key, el);
            }}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
              isActive
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  isActive
                    ? "bg-slate-100 dark:bg-slate-700"
                    : "bg-slate-200/60 dark:bg-slate-800",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
