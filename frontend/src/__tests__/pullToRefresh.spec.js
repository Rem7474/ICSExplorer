import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { usePullToRefresh, PULL_THRESHOLD } from "../composables/usePullToRefresh.js";

const touch = (el, type, x, y) => {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  ev.touches = type === "touchend" ? [] : [{ clientX: x, clientY: y }];
  el.dispatchEvent(ev);
  return ev;
};

const mountPull = (options = {}) => {
  const onRefresh = vi.fn(() => Promise.resolve());
  let state;
  const Comp = defineComponent({
    setup() {
      const target = ref(null);
      state = usePullToRefresh(target, { onRefresh, ...options });
      return () => h("div", { ref: target, class: "area" });
    },
  });
  const wrapper = mount(Comp, { attachTo: document.body });
  return { el: wrapper.element, onRefresh, state: () => state };
};

describe("usePullToRefresh", () => {
  afterEach(() => (document.body.innerHTML = ""));

  it("refreshes after a long enough downward pull", async () => {
    const { el, onRefresh, state } = mountPull();
    touch(el, "touchstart", 100, 100);
    touch(el, "touchmove", 102, 120);
    const move = touch(el, "touchmove", 104, 100 + PULL_THRESHOLD * 2 + 20);
    expect(move.defaultPrevented).toBe(true); // no page bounce while pulling
    expect(state().distance.value).toBeGreaterThanOrEqual(PULL_THRESHOLD);

    touch(el, "touchend");
    expect(state().refreshing.value).toBe(true);
    await flushPromises();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(state().refreshing.value).toBe(false);
    expect(state().distance.value).toBe(0);
  });

  it("does nothing on a short pull", async () => {
    const { el, onRefresh, state } = mountPull();
    touch(el, "touchstart", 100, 100);
    touch(el, "touchmove", 100, 150);
    touch(el, "touchend");
    await flushPromises();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(state().distance.value).toBe(0);
  });

  it("leaves horizontal swipes alone", () => {
    const { el, onRefresh, state } = mountPull();
    touch(el, "touchstart", 200, 100);
    const move = touch(el, "touchmove", 100, 130);
    touch(el, "touchmove", 20, 300);
    expect(move.defaultPrevented).toBe(false);
    expect(state().distance.value).toBe(0);
    touch(el, "touchend");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("respects canStart (e.g. a scrolled-down day)", () => {
    const { el, state } = mountPull({ canStart: () => false });
    touch(el, "touchstart", 100, 100);
    touch(el, "touchmove", 100, 400);
    expect(state().distance.value).toBe(0);
  });
});
