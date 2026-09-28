import { formatRelativeTime, formatDateTime } from "./dates.js";

/**
 * Visitor-facing freshness indicator: how old the displayed data is, rather
 * than server-side sync jargon. Returns { text, level, title } where level is
 * "online" | "warning" | "offline".
 */
export const freshnessBadge = (health, isOnline = true, now = Date.now()) => {
  if (!isOnline) {
    return {
      text: "Hors ligne",
      level: "offline",
      title: "Pas de connexion : affichage des dernières données enregistrées sur cet appareil",
    };
  }
  if (!health) return { text: "En ligne", level: "online", title: "" };

  const lastSync = health.last_sync;
  const age = formatRelativeTime(lastSync, now);
  const syncedAt = lastSync ? `Dernière mise à jour des plannings : ${formatDateTime(lastSync)}` : "";

  if (health.status === "healthy") {
    return { text: age ? `À jour · ${age}` : "À jour", level: "online", title: syncedAt };
  }
  if (lastSync) {
    return { text: `Données anciennes · ${age}`, level: "warning", title: syncedAt };
  }
  return { text: "Mise à jour en attente", level: "warning", title: "Les plannings n'ont pas encore été synchronisés" };
};
