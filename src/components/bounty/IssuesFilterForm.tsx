"use client";

import type { FormEvent, ReactNode } from "react";

/**
 * GET filter form for /issues (#701). A native form submits every named
 * field, including default selects and empty number inputs, which yields
 * non-canonical URLs like `?difficulty=all&minReward=&sort=default`. Fields
 * that are empty or equal to their `data-default` are disabled for the
 * duration of the submit so they are left out of the query string, matching
 * what `buildIssuesHref` produces. Without JavaScript the form still works,
 * just with the longer URL.
 */
export function IssuesFilterForm({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const disabled: HTMLInputElement[] = [];
    for (const el of Array.from(event.currentTarget.elements)) {
      const field = el as HTMLInputElement;
      if (!field.name || field.disabled) continue;
      if (field.value === "" || field.value === field.dataset.default) {
        field.disabled = true;
        disabled.push(field);
      }
    }
    // Re-enable once the submission has captured the form data, so the
    // fields work again if the page is restored from the back/forward cache.
    setTimeout(() => {
      for (const field of disabled) field.disabled = false;
    }, 0);
  }

  return (
    <form method="get" action="/issues" onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
