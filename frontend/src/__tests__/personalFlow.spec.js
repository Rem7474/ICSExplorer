import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { h } from "vue";
import { VApp } from "vuetify/components";
import PersonalScheduleFlow from "../components/personal/PersonalScheduleFlow.vue";
import { useScheduleStore } from "../stores/schedule.js";
import { usePersonalStore } from "../stores/personal.js";

vi.mock("../ics/api.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchUniversities: vi.fn(),
  fetchPersonalCalendar: vi.fn(),
  fetchTreeNodes: vi.fn(),
}));

import { fetchUniversities, fetchPersonalCalendar, fetchTreeNodes } from "../ics/api.js";

const ICS = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
const ESISAR = { id: "grenoble-inp-esisar", name: "Grenoble INP - Esisar" };

// The flow is a dialog: its content is teleported to <body>.
const $ = (sel) => document.body.querySelector(sel);
const $$ = (sel) => [...document.body.querySelectorAll(sel)];
const settle = () => flushPromises().then(flushPromises);
const type = async (sel, value) => {
  const el = $(sel);
  el.value = value;
  el.dispatchEvent(new Event("input"));
  await settle();
};
const click = async (el) => {
  el.click();
  await settle();
};
const byText = (sel, text) => $$(sel).find((el) => el.textContent.includes(text));
const title = () => $(".flow-title")?.textContent;

const mountFlow = async () => {
  const onClose = vi.fn();
  const wrapper = mount({ render: () => h(VApp, () => h(PersonalScheduleFlow, { onClose })) }, { attachTo: document.body });
  await settle();
  return { wrapper, onClose };
};

const signIn = async ({ login = "student1", password = "hunter2", remember = false } = {}) => {
  await click(byText(".university-item", ESISAR.name));
  await type("#loginInput", login);
  await type("#passwordInput", password);
  if (remember) await click($(".remember input"));
  $("#adeLoginForm").dispatchEvent(new Event("submit", { cancelable: true }));
  await settle();
};

describe("PersonalScheduleFlow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchUniversities.mockResolvedValue([ESISAR, { id: "uga", name: "Université Grenoble Alpes" }]);
    fetchPersonalCalendar.mockResolvedValue(ICS);
  });
  afterEach(() => (document.body.innerHTML = ""));

  it("step 1 lists the institutions, then asks for the sign-in", async () => {
    await mountFlow();
    expect(title()).toBe("Mon établissement");
    expect($(".flow-step").textContent).toBe("Étape 1 sur 3");
    expect($$(".university-item").map((i) => i.textContent)).toEqual([ESISAR.name, "Université Grenoble Alpes"]);

    await click(byText(".university-item", ESISAR.name));
    expect(title()).toBe("Connexion à ADE");
    expect($(".picked").textContent).toContain(ESISAR.name);
    // Password managers / iCloud Keychain need these hints.
    expect($("#loginInput").getAttribute("autocomplete")).toBe("username");
    expect($("#passwordInput").getAttribute("autocomplete")).toBe("current-password");
  });

  it("signs in, explores the tree and picks a timetable without storing the password", async () => {
    fetchTreeNodes.mockResolvedValue([
      { id: "10", name: "Filière Informatique", isLeaf: false },
      { id: "101", name: "Groupe 1", isLeaf: true },
    ]);
    await mountFlow();
    await signIn();

    expect(fetchTreeNodes).toHaveBeenCalledWith({ universityId: ESISAR.id, login: "student1", password: "hunter2" });
    expect(title()).toBe("Choisir mon planning");
    expect($$(".node-item").map((n) => n.querySelector(".v-list-item-title").textContent)).toEqual(["Filière Informatique", "Groupe 1"]);

    await click(byText(".node-leaf", "Groupe 1"));
    expect(fetchPersonalCalendar).toHaveBeenCalledWith({ universityId: ESISAR.id, resourceId: "101", login: "student1", password: "hunter2" });

    const schedule = useScheduleStore();
    expect(schedule.selectedMode).toBe("personal");
    expect(usePersonalStore().personalScheduleInfo).not.toHaveProperty("password");
    expect(localStorage.getItem("edtPersonalCreds")).toBeNull();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      expect(localStorage.getItem(key), `localStorage["${key}"]`).not.toContain("hunter2");
    }
  });

  it("stores the credentials only when 'remember' is on", async () => {
    fetchTreeNodes.mockResolvedValue([{ id: "101", name: "3A - Ingénieur", isLeaf: true }]);
    await mountFlow();
    await signIn({ remember: true });
    await click(byText(".node-leaf", "3A - Ingénieur"));

    expect(JSON.parse(localStorage.getItem("edtPersonalCreds"))).toEqual({
      inputMode: "list",
      universityId: ESISAR.id,
      universityName: ESISAR.name,
      login: "student1",
      password: "hunter2",
      resourceId: "101",
      resourceName: "3A - Ingénieur",
      branchPath: [],
    });
  });

  it("accepts an ADE address instead of an institution", async () => {
    fetchTreeNodes.mockResolvedValue([{ id: "201", name: "Mon planning", isLeaf: true }]);
    await mountFlow();
    await click($(".url-item"));
    expect(title()).toBe("Connexion à ADE");
    await type("#adeUrlInput", "https://edt.grenoble-inp.fr/x");
    $("#adeLoginForm").dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();

    expect(fetchTreeNodes).toHaveBeenCalledWith({ adeUrl: "https://edt.grenoble-inp.fr/x", login: "", password: "" });
  });

  it("stays on the sign-in step with the error when ADE refuses", async () => {
    fetchTreeNodes.mockRejectedValue(new Error("Identifiants invalides"));
    await mountFlow();
    await signIn({ password: "wrong" });
    expect(title()).toBe("Connexion à ADE");
    expect($('[role="alert"]').textContent).toContain("Identifiants invalides");
  });

  it("opens folders, goes back up with the back arrow, and can pick a whole folder", async () => {
    fetchTreeNodes.mockImplementation(async ({ branchId }) =>
      branchId === "10"
        ? [{ id: "101", name: "Groupe 1", isLeaf: true }]
        : [{ id: "10", name: "Filière Informatique", isLeaf: false }]
    );
    await mountFlow();
    await signIn();

    await click(byText(".node-branch", "Filière Informatique"));
    expect($$(".crumbs .v-chip").map((c) => c.textContent.trim())).toEqual(["Racine", "Filière Informatique"]);
    expect(byText(".node-leaf", "Groupe 1")).toBeTruthy();

    // Back arrow: parent folder first, not the previous step.
    await click($('[aria-label="Dossier précédent"]'));
    expect(title()).toBe("Choisir mon planning");
    expect(byText(".node-branch", "Filière Informatique")).toBeTruthy();

    await click(byText(".node-branch", "Filière Informatique"));
    await click($(".choose-branch"));
    expect(fetchPersonalCalendar).toHaveBeenCalledWith({
      universityId: ESISAR.id,
      resourceId: "10",
      branchPath: ["10"],
      login: "student1",
      password: "hunter2",
    });
  });

  it("picks a folder straight from the list", async () => {
    fetchTreeNodes.mockResolvedValue([{ id: "10", name: "Filière Informatique", isLeaf: false }]);
    await mountFlow();
    await signIn();
    await click($(".choose-btn"));
    expect(fetchPersonalCalendar).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "10", branchPath: ["10"] }));
  });

  it("opens straight on the tree when a configuration is saved", async () => {
    localStorage.setItem("edtPersonalCreds", JSON.stringify({ inputMode: "url", adeUrl: "https://ade-uga.fr/direct/index.jsp?data=token" }));
    fetchTreeNodes.mockResolvedValue([{ id: "1674", name: "CAMPUS Grenoble", isLeaf: false }]);
    await mountFlow();

    expect(fetchTreeNodes).toHaveBeenCalledWith({
      adeUrl: "https://ade-uga.fr/direct/index.jsp?data=token",
      login: "",
      password: "",
      branchId: undefined,
      branchPath: undefined,
    });
    expect(title()).toBe("Choisir mon planning");
    expect(byText(".node-branch", "CAMPUS Grenoble")).toBeTruthy();
  });

  it("asks for the password when only the schedule (not the credentials) was kept", async () => {
    usePersonalStore().personalScheduleInfo = { name: "Groupe 1", universityId: ESISAR.id, resourceId: "101" };
    await mountFlow();
    expect(title()).toBe("Connexion à ADE");
    expect($('[role="alert"]')).toBeNull();
    expect(fetchTreeNodes).not.toHaveBeenCalled();
  });

  it("closes from step 1", async () => {
    await mountFlow();
    expect($(".v-overlay--active")).not.toBeNull();
    await click($('[aria-label="Fermer"]'));
    expect($(".v-overlay--active")).toBeNull();
  });
});
