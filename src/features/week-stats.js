import { getSubjectType, getSubjectColors } from "../utils/colors.js";
import { escapeHtml } from "../utils/dom.js";

const formatHours = (mins) => {
  if (mins < 60) return `${Math.round(mins)} min`;
  const hours = mins / 60;
  const rounded = Math.round(hours * 10) / 10;
  // Avoid "2.0h" → "2h"
  const text =
    Number.isInteger(rounded)
      ? `${rounded}h`
      : `${rounded.toString().replace(".", ",")}h`;
  return text;
};

export const computeWeekStats = (events) => {
  let totalMinutes = 0;
  const byType = new Map();
  for (const ev of events) {
    const ms = new Date(ev.end) - new Date(ev.start);
    const mins = ms / 60000;
    if (!Number.isFinite(mins) || mins <= 0) continue;
    totalMinutes += mins;
    const type = getSubjectType(ev.summary) || "—";
    byType.set(type, (byType.get(type) || 0) + mins);
  }
  return { totalMinutes, byType };
};

export const renderWeekStats = (container, events) => {
  if (!container) return;
  if (!events || !events.length) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  const { totalMinutes, byType } = computeWeekStats(events);
  if (totalMinutes <= 0) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  const chips = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, mins]) => {
      const colors = getSubjectColors(type);
      return `<span class="stat-chip" style="--event-bg: ${colors.background}; --event-border: ${colors.border}; --event-text: ${colors.text};">
        ${escapeHtml(type)}<strong>${escapeHtml(formatHours(mins))}</strong>
      </span>`;
    })
    .join("");

  container.style.display = "";
  container.innerHTML = `
    <div class="stats-total">${escapeHtml(formatHours(totalMinutes))} cette semaine</div>
    <div class="stats-chips">${chips}</div>
  `;
};
