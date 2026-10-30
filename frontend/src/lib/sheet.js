import { useCallback, useRef } from 'react';

const EASE_IOS = 'cubic-bezier(0.32, 0.72, 0, 1)';
const isSheetLayout = () => window.matchMedia('(max-width: 639px)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Closing for a bottom sheet: `dismiss()` slides it down before calling
 * `onClose`, and `dragHandlers` (spread onto the grabber/header) let the user
 * pull it down, closing past a third of its height or on a quick flick.
 * On wide screens both just call `onClose`.
 */
export function useSheetDismiss(sheetRef, overlayRef, onClose) {
  const drag = useRef(null);
  const closing = useRef(false);

  const dismiss = useCallback(() => {
    const sheet = sheetRef.current;
    if (closing.current) return;
    if (!sheet || !isSheetLayout() || reducedMotion()) { onClose(); return; }
    closing.current = true;
    sheet.style.transition = `transform 0.3s ${EASE_IOS}`;
    sheet.style.transform = 'translateY(100%)';
    if (overlayRef?.current) {
      overlayRef.current.style.transition = 'opacity 0.3s ease';
      overlayRef.current.style.opacity = '0';
    }
    setTimeout(onClose, 280);
  }, [sheetRef, overlayRef, onClose]);

  const onTouchStart = (e) => {
    if (!isSheetLayout() || e.touches.length !== 1 || e.target.closest('button')) return;
    drag.current = { y: e.touches[0].clientY, time: performance.now() };
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };

  const onTouchMove = (e) => {
    if (!drag.current || !sheetRef.current) return;
    const dy = e.touches[0].clientY - drag.current.y;
    // Pulling up resists, as it does on iOS.
    const offset = dy > 0 ? dy : -Math.sqrt(-dy) * 2;
    sheetRef.current.style.transform = `translateY(${offset}px)`;
  };

  const onTouchEnd = (e) => {
    if (!drag.current || !sheetRef.current) return;
    const sheet = sheetRef.current;
    const dy = e.changedTouches[0].clientY - drag.current.y;
    const velocity = dy / (performance.now() - drag.current.time);
    drag.current = null;
    if (dy > sheet.offsetHeight / 3 || (dy > 20 && velocity > 0.5)) {
      dismiss();
    } else {
      sheet.style.transition = `transform 0.35s ${EASE_IOS}`;
      sheet.style.transform = '';
    }
  };

  return {
    dismiss,
    dragHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  };
}
