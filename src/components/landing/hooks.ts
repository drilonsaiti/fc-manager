"use client";
import { useEffect, type RefObject } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds `.in` to every [data-r]/[data-l] element once it scrolls into view. Class changes only, no React state. */
export function useReveal(root: RefObject<HTMLElement | null>, ready: boolean) {
  useEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const items = el.querySelectorAll<HTMLElement>("[data-r],[data-l]");
    if (!("IntersectionObserver" in window)) { items.forEach((n) => n.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
    items.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root, ready]);
}

/** Smooth scroll (Lenis) + hero parallax + sticky-nav state, all written straight to the DOM. */
export function useScrollFx(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = prefersReducedMotion();
    const nav = el.querySelector<HTMLElement>(".lp-nav");
    const hero = el.querySelector<HTMLElement>(".lp-hero");
    let raf = 0;
    let stop = false;
    let lenis: { raf: (t: number) => void; destroy: () => void; scrollTo: (t: HTMLElement | number, o?: object) => void } | null = null;

    const onScroll = () => {
      const y = window.scrollY;
      nav?.classList.toggle("solid", y > 40);
      if (hero && !reduced && y < window.innerHeight * 1.2) hero.style.setProperty("--py", `${y * 0.22}px`);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (!reduced) {
      import("lenis").then(({ default: Lenis }) => {
        if (stop) return;
        const l = new Lenis({ duration: 1.15, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
        lenis = l;
        const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
      }).catch(() => {});
    }

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a) return;
      const target = el.querySelector<HTMLElement>(a.getAttribute("href")!);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -60 });
      else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    };
    el.addEventListener("click", onClick);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
      window.removeEventListener("scroll", onScroll);
      el.removeEventListener("click", onClick);
    };
  }, [root]);
}
