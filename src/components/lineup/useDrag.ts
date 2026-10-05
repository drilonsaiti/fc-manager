"use client";
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface DragItem { playerId: string; fromSlot: string | null }
export type DropTarget =
  | { kind: "slot"; id: string }
  | { kind: "bench" }
  | { kind: "pool" }
  | { kind: "pitch" };

export interface DragState { item: DragItem; label: string; x: number; y: number; over: DropTarget | null }

/** Reads data-drop="slot:<id>" | "bench" | "pool" | "pitch" from whatever is under the pointer. */
function targetAt(x: number, y: number): DropTarget | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const v = (el as HTMLElement).dataset?.drop;
    if (!v) continue;
    if (v.startsWith("slot:")) return { kind: "slot", id: v.slice(5) };
    if (v === "bench" || v === "pool" || v === "pitch") return { kind: v };
  }
  return null;
}

/**
 * Pointer-based drag & drop that works the same with a mouse and a finger (no library).
 * Mouse: drag after moving 5px. Touch: press and hold ~0.2s, so normal scrolling still works.
 * A plain tap never becomes a drag, so tap-to-assign keeps working; `wasDrag()` lets click handlers
 * ignore the click the browser fires right after a drop.
 */
export function useDrag(onDrop: (item: DragItem, target: DropTarget | null, point: { x: number; y: number }) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const justDragged = useRef(false);

  const begin = useCallback((e: ReactPointerEvent, item: DragItem, label: string) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const touch = e.pointerType !== "mouse";
    const id = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    let active = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let lastX = startX, lastY = startY;

    // Near the top/bottom edge of the screen, scroll the page so a long list can be reached mid-drag.
    const EDGE_TOP = 70, EDGE_BOTTOM = 30;
    const autoScroll = () => {
      if (!active) return;
      const dy = lastY < EDGE_TOP ? -14 : lastY > window.innerHeight - EDGE_BOTTOM ? 14 : 0;
      if (dy) {
        window.scrollBy(0, dy);
        setDrag((d) => (d ? { ...d, over: targetAt(lastX, lastY) } : d));
      }
      frame = requestAnimationFrame(autoScroll);
    };

    const start = () => {
      active = true;
      navigator.vibrate?.(12);
      frame = requestAnimationFrame(autoScroll);
      setDrag({ item, label, x: startX, y: startY, over: targetAt(startX, startY) });
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", block);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      if (!active) {
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (touch) { if (dist > 10) cleanup(); return; } // finger moved first: it's a scroll
        if (dist < 5) return;
        start();
      }
      lastX = ev.clientX; lastY = ev.clientY;
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY, over: targetAt(ev.clientX, ev.clientY) } : d));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      cleanup();
      if (!active) return;
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      setDrag(null);
      // The last move is the most reliable release point (some touch stacks report 0,0 on pointerup).
      onDrop(item, targetAt(lastX, lastY), { x: lastX, y: lastY });
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      cleanup();
      if (active) setDrag(null);
    };
    // Once a touch drag has started, stop the page from scrolling under the finger.
    const block = (ev: TouchEvent) => { if (active && ev.cancelable) ev.preventDefault(); };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", block, { passive: false });
    if (touch) timer = setTimeout(start, 220);
  }, [onDrop]);

  const wasDrag = useCallback(() => justDragged.current, []);
  return { drag, begin, wasDrag };
}
