import { createRouter, createWebHistory } from "vue-router";

// Phase 0: a single screen whose state lives in the query string
// (?file=…, ?teacher=…, ?room=…, ?mode=personal), unchanged from previous
// versions so shared links and bookmarks keep working. Dedicated screens
// (search, free rooms, settings) are added as routes in the next phases.
const Empty = { render: () => null };

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "planning", component: Empty },
    // The Go server serves index.html for any unknown path (SPA fallback).
    { path: "/:pathMatch(.*)*", component: Empty },
  ],
});

/** The schedule-related query keys managed by the app. */
export const SCHEDULE_QUERY_KEYS = ["file", "mode", "teacher", "room"];
