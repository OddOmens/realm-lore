import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

// Navigation that behaves like a UINavigationController on phones: pages push
// in from the right and pop back from the left, each page keeps its own scroll
// position, and in the installed app a swipe from the left edge goes back.

const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';

const matches = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches;
export const isPhoneLayout = () => matches('(max-width: 1023px)');
export const isStandalone = () => matches('(display-mode: standalone)') || window.navigator.standalone === true;
const reducedMotion = () => matches('(prefers-reduced-motion: reduce)');

/**
 * The element that scrolls the current page: `root` itself, or (as most pages
 * do) the outermost full-height scroller inside it.
 */
export function pageScroller(root) {
  if (!root) return null;
  if (root.scrollHeight > root.clientHeight + 1) return root;
  const min = root.clientHeight / 2;
  for (const el of root.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')) {
    if (el.clientHeight >= min) return el;
  }
  return root;
}

/**
 * Animates `pageRef` on route changes and saves/restores the page's scroll
 * position (inside `scrollRef`) per history entry.
 */
export function useRouteTransitions(pageRef, scrollRef) {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(new Map());
  const currentKey = useRef(location.key);

  // Remember where each history entry was scrolled to. Scroll events don't
  // bubble, so listen in the capture phase to hear the page's own scroller.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = (e) => {
      if (e.target === pageScroller(root)) positions.current.set(currentKey.current, e.target.scrollTop);
    };
    root.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => root.removeEventListener('scroll', onScroll, { capture: true });
  }, [scrollRef]);

  useLayoutEffect(() => {
    if (currentKey.current === location.key) return;
    currentKey.current = location.key;
    const root = scrollRef.current;
    const page = pageRef.current;

    // New pages start at the top; going back returns to where you were. Lazy
    // pages may not have rendered yet, so keep trying for a few frames.
    let frame;
    if (root) {
      const target = navType === 'POP' ? positions.current.get(location.key) || 0 : 0;
      let tries = 0;
      const restore = () => {
        const el = pageScroller(root);
        el.scrollTop = target;
        if (el.scrollTop < target - 1 && tries++ < 30) frame = requestAnimationFrame(restore);
      };
      restore();
    }

    // Tab switches swap instantly, as they do on iOS. Back in a browser tab is
    // left alone: Safari and Chrome animate their own back gesture.
    if (!page || !isPhoneLayout() || reducedMotion()) return () => cancelAnimationFrame(frame);
    if (navType === 'REPLACE' || location.state?.tab) return () => cancelAnimationFrame(frame);
    if (navType === 'POP' && !isStandalone()) return () => cancelAnimationFrame(frame);

    const from = navType === 'POP' ? 'translateX(-28%)' : 'translateX(36%)';
    page.animate(
      [{ transform: from, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: EASE_IOS },
    );
    return () => cancelAnimationFrame(frame);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Elements that handle horizontal drags themselves (the map canvas, sheets).
function ownsTouch(target, root) {
  for (let el = target; el && el !== root; el = el.parentElement) {
    if (el.matches?.('[role="dialog"], [data-no-swipe-back]')) return true;
    if (getComputedStyle(el).touchAction === 'none') return true;
  }
  return false;
}

/**
 * In the installed app iOS gives no back gesture, so provide one: drag from
 * the left edge of `pageRef` to go back.
 */
export function useEdgeSwipeBack(pageRef) {
  const navigate = useNavigate();

  useEffect(() => {
    const page = pageRef.current;
    if (!page || !isStandalone()) return;

    let drag = null;
    const reset = (animate) => {
      page.style.transition = animate ? `transform 0.3s ${EASE_IOS}` : '';
      page.style.transform = '';
      page.style.boxShadow = '';
    };

    const onStart = (e) => {
      if (e.touches.length !== 1 || !isPhoneLayout()) return;
      const t = e.touches[0];
      if (t.clientX > 24) return;
      if ((window.history.state?.idx ?? 0) < 1) return;
      if (ownsTouch(e.target, page)) return;
      drag = { x: t.clientX, y: t.clientY, time: performance.now(), moving: false };
    };

    const onMove = (e) => {
      if (!drag) return;
      const t = e.touches[0];
      const dx = t.clientX - drag.x;
      const dy = t.clientY - drag.y;
      if (!drag.moving) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        if (dx < 8) return;
        drag.moving = true;
        page.style.transition = 'none';
        page.style.boxShadow = '-12px 0 24px rgba(0,0,0,0.25)';
      }
      e.preventDefault();
      page.style.transform = `translateX(${Math.max(0, dx)}px)`;
    };

    const onEnd = (e) => {
      if (!drag?.moving) { drag = null; return; }
      const dx = e.changedTouches[0].clientX - drag.x;
      const velocity = dx / (performance.now() - drag.time);
      drag = null;
      const width = page.offsetWidth;
      if (dx > width * 0.35 || velocity > 0.5) {
        page.style.transition = `transform 0.22s ${EASE_IOS}`;
        page.style.transform = `translateX(${width}px)`;
        setTimeout(() => { reset(false); navigate(-1); }, 200);
      } else {
        reset(true);
      }
    };

    page.addEventListener('touchstart', onStart, { passive: true });
    page.addEventListener('touchmove', onMove, { passive: false });
    page.addEventListener('touchend', onEnd);
    page.addEventListener('touchcancel', onEnd);
    return () => {
      page.removeEventListener('touchstart', onStart);
      page.removeEventListener('touchmove', onMove);
      page.removeEventListener('touchend', onEnd);
      page.removeEventListener('touchcancel', onEnd);
    };
  }, [pageRef, navigate]);
}

/** Keeps the browser/status-bar tint in step with the current theme. */
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
  if (!bg) return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = `hsl(${bg})`;
}
