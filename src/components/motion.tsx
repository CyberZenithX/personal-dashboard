'use client';
/**
 * Motion helpers: page transitions, exit animations for things that unmount, animated lists and count-up numbers.
 * Everything here respects "reduce motion" (the CSS in globals.css flattens the animations, and the JS ones skip).
 */
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Children, isValidElement, useEffect, useLayoutEffect, useReducer, useRef, useState,
  type ComponentProps, type Key, type MouseEvent, type ReactElement, type ReactNode
} from 'react';

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------------------------------------- page transitions */

/** Page order, so the phone slide goes left or right like moving between tabs. */
const ORDER = ['/', '/tasks', '/voice', '/notes', '/calendar', '/progress', '/settings'];

let settle: (() => void) | null = null;

/** Called by the Shell once the new page has rendered: lets the view transition run. */
export function routeRendered(): void {
  settle?.();
  settle = null;
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => Promise<void>) => unknown };

/** Navigate with a view transition (crossfade + rise on desktop, a slide on phone) where the browser supports it. */
export function navigate(router: ReturnType<typeof useRouter>, href: string, mode: 'push' | 'replace' = 'push'): void {
  const go = () => (mode === 'push' ? router.push(href) : router.replace(href));
  const doc = document as ViewTransitionDoc;
  const to = new URL(href, location.href);
  // Same page (only the ?query changes) or no support: just go.
  if (to.pathname === location.pathname || !doc.startViewTransition || reducedMotion()) return go();
  const a = ORDER.indexOf(location.pathname);
  const b = ORDER.indexOf(to.pathname);
  document.documentElement.dataset.nav = a >= 0 && b >= 0 && b < a ? 'back' : 'forward';
  settle?.();
  doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        settle = resolve;
        go();
        // never leave the screen frozen if the page is slow to arrive
        setTimeout(resolve, 900);
      })
  );
}

/** next/link that animates between pages. Same props. */
export function Link({ onClick, href, ...rest }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  const url = typeof href === 'string' ? href : (href.pathname ?? '/') + (href.search ?? '');
  return (
    <NextLink
      href={href}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
        e.preventDefault();
        navigate(router, url, rest.replace ? 'replace' : 'push');
      }}
    />
  );
}

/** useRouter, but push/replace/back animate between pages. */
export function useNav() {
  const router = useRouter();
  return {
    push: (href: string) => navigate(router, href),
    replace: (href: string) => navigate(router, href, 'replace'),
    back: () => {
      const doc = document as ViewTransitionDoc;
      if (!doc.startViewTransition || reducedMotion()) return router.back();
      document.documentElement.dataset.nav = 'back';
      const from = location.pathname;
      doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            settle = resolve;
            router.back();
            setTimeout(resolve, 900);
            // back to a page with the same path never re-renders the Shell
            setTimeout(() => location.pathname === from && resolve(), 300);
          })
      );
    }
  };
}

/** Runs routeRendered after every page change. */
export function useRouteSettle(pathname: string): void {
  useLayoutEffect(() => {
    routeRendered();
  }, [pathname]);
}

/* ---------------------------------------------------------------- presence */

/**
 * Keeps its children on screen for a moment after `show` turns false, marked `.leaving`,
 * so sheets, dialogs and toasts can animate out instead of vanishing.
 */
export function Presence({ show, ms = 180, children }: { show: boolean; ms?: number; children: ReactNode }) {
  const last = useRef<ReactNode>(children);
  if (show) last.current = children;
  const [prevShow, setPrevShow] = useState(show);
  const [leaving, setLeaving] = useState(false);
  if (prevShow !== show) {
    setPrevShow(show);
    setLeaving(!show && !reducedMotion());
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), ms);
    return () => clearTimeout(t);
  }, [leaving, ms]);
  if (!show && !leaving) return null;
  return (
    <div className={leaving ? 'leaving' : undefined} inert={leaving || undefined} style={{ display: 'contents' }}>
      {show ? children : last.current}
    </div>
  );
}

/* ---------------------------------------------------------------- animated list */

type Item = { key: Key; el: ReactElement };

/**
 * Renders keyed children; new ones slide in, removed ones collapse out.
 * Each child is wrapped in a div, so it works inside a flex column (the parent's gap is respected).
 */
export function AnimatedList({ children }: { children: ReactNode }) {
  const kids: Item[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.key != null) kids.push({ key: c.key, el: c });
  });
  const store = useRef<{ prev: Item[]; leaving: Map<Key, ReactElement>; mounted: boolean }>({ prev: [], leaving: new Map(), mounted: false });
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const s = store.current;
  const now = new Set(kids.map((k) => k.key));
  const before = new Set(s.prev.map((k) => k.key));
  for (const k of now) s.leaving.delete(k);
  if (s.mounted && !reducedMotion()) for (const p of s.prev) if (!now.has(p.key)) s.leaving.set(p.key, s.leaving.get(p.key) ?? p.el);

  // put leaving items back where they were
  const merged: Item[] = [...kids];
  s.prev.forEach((p, i) => {
    if (!s.leaving.has(p.key) || now.has(p.key)) return;
    const prevKey = i > 0 ? s.prev[i - 1].key : null;
    const at = prevKey == null ? 0 : merged.findIndex((m) => m.key === prevKey) + 1;
    merged.splice(at > 0 ? at : Math.min(i, merged.length), 0, { key: p.key, el: s.leaving.get(p.key)! });
  });
  const isNew = (k: Key) => s.mounted && !before.has(k);
  const rows = merged.map((m) => ({ ...m, leaving: s.leaving.has(m.key), entering: isNew(m.key) }));

  useEffect(() => {
    s.prev = merged;
    s.mounted = true;
  });

  return (
    <>
      {rows.map((r) =>
        r.leaving ? (
          <div
            key={r.key} inert aria-hidden="true"
            ref={(el) => {
              if (!el || el.dataset.out) return;
              el.dataset.out = '1';
              const gap = parseFloat(getComputedStyle(el.parentElement ?? el).rowGap) || 0;
              const h = el.offsetHeight;
              el.style.overflow = 'hidden';
              const a = el.animate(
                [{ height: h + 'px', opacity: 1, transform: 'none' }, { height: '0px', opacity: 0, marginBottom: -gap + 'px', transform: 'scale(.98)' }],
                { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
              );
              a.onfinish = () => {
                s.leaving.delete(r.key);
                s.prev = s.prev.filter((p) => p.key !== r.key);
                rerender();
              };
            }}
          >
            {r.el}
          </div>
        ) : (
          <div key={r.key} className={r.entering ? 'row-in' : undefined}>{r.el}</div>
        )
      )}
    </>
  );
}

/* ---------------------------------------------------------------- numbers */

/** A number that counts to its new value instead of jumping. */
export function useCountUp(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value || reducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Renders a number that counts up/down when it changes. */
export function Count({ value }: { value: number }) {
  return <>{useCountUp(value).toLocaleString()}</>;
}
