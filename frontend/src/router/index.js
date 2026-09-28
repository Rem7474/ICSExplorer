import { createRouter, createWebHistory } from "vue-router";
import PlanningView from "../views/PlanningView.vue";

// The planning keeps its state in the query string (?file=…, ?teacher=…,
// ?room=…, ?mode=personal), unchanged from previous versions so shared links
// and bookmarks keep working. The other tabs are lazy-loaded screens.
export const PLANNING_PATH = "/";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: PLANNING_PATH, name: "planning", component: PlanningView, meta: { tab: "planning" } },
    { path: "/rechercher", name: "search", component: () => import("../views/SearchView.vue"), meta: { tab: "search" } },
    { path: "/salles", name: "rooms", component: () => import("../views/FreeRoomsView.vue"), meta: { tab: "rooms" } },
    { path: "/plus", name: "more", component: () => import("../views/MoreView.vue"), meta: { tab: "more" } },
    // The Go server serves index.html for any unknown path (SPA fallback).
    { path: "/:pathMatch(.*)*", redirect: (to) => ({ path: PLANNING_PATH, query: to.query }) },
  ],
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
});

/** The schedule-related query keys managed by the app. */
export const SCHEDULE_QUERY_KEYS = ["file", "mode", "teacher", "room"];
