import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ToastContainer from "../components/ToastContainer.vue";
import { useToast } from "../composables/useToast.js";

describe("Toast notification system", () => {
  it("adds and renders toast notifications", async () => {
    const { showToast, toasts } = useToast();

    const wrapper = mount(ToastContainer);
    expect(wrapper.findAll(".toast-item").length).toBe(0);

    showToast("Opération réussie", "success");
    await wrapper.vm.$nextTick();

    expect(toasts.value.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("Opération réussie");
  });
});
