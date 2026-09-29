import { ref, onMounted, onBeforeUnmount } from "vue";

export const PULL_THRESHOLD = 72; // px of (damped) pull needed to refresh
const MAX_PULL = 110;
const HOLD_AT = 56; // where the spinner rests while refreshing
const LOCK_DISTANCE = 8; // px before deciding between a pull and a swipe

/**
 * Pull-to-refresh on touch screens (iOS home-screen apps have none).
 * Only a mostly-vertical downward drag starting at the top counts, so the
 * planning's horizontal swipe keeps working.
 *
 * @param {import("vue").Ref<HTMLElement>} target element receiving the gesture
 * @param {{ onRefresh: () => Promise<unknown>, canStart?: (e: TouchEvent) => boolean }} options
 */
export function usePullToRefresh(target, { onRefresh, canStart = () => true }) {
  const distance = ref(0);
  const refreshing = ref(false);

  let startX = 0;
  let startY = 0;
  let state = "idle"; // idle | maybe | pulling

  const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

  const onStart = (e) => {
    if (refreshing.value || e.touches.length !== 1 || !atTop() || !canStart(e)) {
      state = "idle";
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    state = "maybe";
  };

  const onMove = (e) => {
    if (state === "idle") return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (state === "maybe") {
      if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
      state = dy > 0 && dy > Math.abs(dx) * 1.2 ? "pulling" : "idle";
      if (state === "idle") return;
    }
    // Ours now: stop the page/scroller from bouncing.
    if (e.cancelable) e.preventDefault();
    distance.value = Math.max(0, Math.min(MAX_PULL, (dy - LOCK_DISTANCE) * 0.55));
  };

  const onEnd = async () => {
    if (state !== "pulling") {
      state = "idle";
      return;
    }
    state = "idle";
    if (distance.value < PULL_THRESHOLD) {
      distance.value = 0;
      return;
    }
    refreshing.value = true;
    distance.value = HOLD_AT;
    try {
      await onRefresh();
    } finally {
      refreshing.value = false;
      distance.value = 0;
    }
  };

  onMounted(() => {
    const el = target.value;
    if (!el) return;
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
  });

  onBeforeUnmount(() => {
    const el = target.value;
    if (!el) return;
    el.removeEventListener("touchstart", onStart);
    el.removeEventListener("touchmove", onMove);
    el.removeEventListener("touchend", onEnd);
    el.removeEventListener("touchcancel", onEnd);
  });

  return { distance, refreshing };
}
