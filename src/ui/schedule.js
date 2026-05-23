import { formatDateOnly, formatTimeOnly } from "../utils/dates.js";
import { escapeHtml } from "../utils/dom.js";
import { getSubjectType, getSubjectColors } from "../utils/colors.js";

const DEFAULT_HOUR_START = 8;
const DEFAULT_HOUR_END = 18;
const SCHEDULE_PX = 600;

let HOUR_START = DEFAULT_HOUR_START;
let HOUR_END = DEFAULT_HOUR_END;
let HOURS_TOTAL = HOUR_END - HOUR_START;
let PX_PER_HOUR = SCHEDULE_PX / HOURS_TOTAL;

const isMobileViewport = () =>
  window.matchMedia("(max-width: 480px)").matches;

// Compute schedule range from events: default 8-18, expanded to fit outliers.
// Applies on both desktop and mobile so a day has the same scale across days,
// keeping swipe transitions visually stable.
const adjustHoursToFit = (events) => {
  if (!events.length) {
    HOUR_START = DEFAULT_HOUR_START;
    HOUR_END = DEFAULT_HOUR_END;
  } else {
    const startHours = events.map((e) => new Date(e.start).getHours());
    const endHoursCeil = events.map((e) => {
      const d = new Date(e.end);
      return d.getHours() + (d.getMinutes() > 0 ? 1 : 0);
    });
    HOUR_START = Math.min(DEFAULT_HOUR_START, ...startHours);
    HOUR_END = Math.max(DEFAULT_HOUR_END, ...endHoursCeil);
  }

  HOURS_TOTAL = Math.max(1, HOUR_END - HOUR_START);
  PX_PER_HOUR = SCHEDULE_PX / HOURS_TOTAL;

  const root = document.documentElement.style;
  root.setProperty("--hour-start", HOUR_START);
  root.setProperty("--hour-end", HOUR_END);
  root.setProperty("--hours-total", HOURS_TOTAL);
  root.setProperty("--px-per-hour", PX_PER_HOUR + "px");
};

const getEventTop = (date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const relativeHours = hours - HOUR_START + minutes / 60;
  return Math.max(0, relativeHours * PX_PER_HOUR);
};

const getEventHeight = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMinutes = (endDate - startDate) / 60000;
  return Math.max(20, (durationMinutes / 60) * PX_PER_HOUR);
};

const groupEventsByDay = (events) =>
  events.reduce((acc, event) => {
    const dayKey = formatDateOnly(event.start);
    if (!acc.has(dayKey)) acc.set(dayKey, []);
    acc.get(dayKey).push(event);
    return acc;
  }, new Map());

// Greedy column packing per cluster of mutually-overlapping events.
const layoutDayEvents = (events) => {
  const items = events.map((event) => ({
    event,
    startT: new Date(event.start).getTime(),
    endT: new Date(event.end).getTime(),
  }));
  items.sort((a, b) => a.startT - b.startT || b.endT - a.endT);

  const layout = new Map();
  let cluster = [];
  let clusterMaxEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const lanes = [];
    const colByIdx = [];
    cluster.forEach((item) => {
      let lane = lanes.findIndex((endT) => endT <= item.startT);
      if (lane === -1) {
        lanes.push(item.endT);
        lane = lanes.length - 1;
      } else {
        lanes[lane] = item.endT;
      }
      colByIdx.push(lane);
    });
    const cols = lanes.length;
    cluster.forEach((item, idx) => {
      layout.set(item.event, { col: colByIdx[idx], cols });
    });
    cluster = [];
    clusterMaxEnd = -Infinity;
  };

  for (const item of items) {
    if (item.startT >= clusterMaxEnd) flush();
    cluster.push(item);
    clusterMaxEnd = Math.max(clusterMaxEnd, item.endT);
  }
  flush();

  return layout;
};

const renderDay = (day, dayEvents, todayKey, eventIndex) => {
  const layout = layoutDayEvents(dayEvents);

  const eventElements = dayEvents
    .map((event, idx) => {
      const summary = event.summary || "(Sans titre)";
      const timeRange = `${formatTimeOnly(event.start)} - ${formatTimeOnly(event.end)}`;
      const top = getEventTop(new Date(event.start));
      const height = getEventHeight(event.start, event.end);
      const subjectType = getSubjectType(summary);
      const colors = getSubjectColors(summary);
      const { col, cols } = layout.get(event) || { col: 0, cols: 1 };
      const eventId = `${day}__${idx}`;
      eventIndex.set(eventId, event);

      const locationLine = event.location
        ? `<p><strong>Lieu :</strong> ${escapeHtml(event.location)}</p>`
        : "";

      return `
        <div class="event"
             role="button" tabindex="0"
             style="--event-top: ${top}px; --event-height: ${height}px; --event-col: ${col}; --event-cols: ${cols}; --event-bg: ${colors.background}; --event-border: ${colors.border}; --event-text: ${colors.text}; --event-subtext: ${colors.subtext};"
             data-event-id="${escapeHtml(eventId)}"
             data-subject-type="${escapeHtml(subjectType)}"
             aria-label="${escapeHtml(`${summary}, ${timeRange}${event.location ? ", " + event.location : ""}`)}">
          <h3>${escapeHtml(summary)}</h3>
          <p>${escapeHtml(timeRange)}</p>
          ${locationLine}
        </div>
      `;
    })
    .join("");

  const now = new Date();
  const isToday = day === todayKey;
  const isWithinBusinessHours =
    now.getHours() >= HOUR_START && now.getHours() < HOUR_END;
  const currentTimeTop =
    isToday && isWithinBusinessHours ? getEventTop(now) : null;
  const currentTimeIndicator =
    currentTimeTop !== null
      ? `<div class="current-time-line" style="--indicator-top: ${currentTimeTop}px;" aria-hidden="true"></div>`
      : "";

  return `
    <div class="day-group ${isToday ? "today" : ""}">
      <div class="day-title">${escapeHtml(day)}</div>
      <div class="day-schedule">
        ${currentTimeIndicator}
        ${eventElements}
      </div>
    </div>
  `;
};

const renderHourRail = () => {
  const ticks = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const top = (h - HOUR_START) * PX_PER_HOUR;
    ticks.push(
      `<span class="hour-tick" style="--tick-top: ${top}px;">${h}h</span>`
    );
  }
  return `
    <div class="hour-rail" aria-hidden="true">
      <div class="day-title hour-rail-spacer">&nbsp;</div>
      <div class="hour-rail-body" style="min-height: ${SCHEDULE_PX}px;">
        ${ticks.join("")}
      </div>
    </div>
  `;
};

// All days share the same min-height for visual consistency,
// especially important in the mobile horizontal-swipe view.
const adjustDayHeights = (container) => {
  const dayScheds = container.querySelectorAll(".day-schedule");
  if (!dayScheds.length) return;

  let maxBottom = 0;
  dayScheds.forEach((schedule) => {
    schedule.querySelectorAll(".event").forEach((el) => {
      const top = parseFloat(el.style.getPropertyValue("--event-top")) || 0;
      const height =
        parseFloat(el.style.getPropertyValue("--event-height")) || 0;
      const bottom = top + height;
      if (bottom > maxBottom) maxBottom = bottom;
    });
  });

  const minHeight = Math.max(maxBottom + 10, SCHEDULE_PX);
  dayScheds.forEach((schedule) => {
    schedule.style.minHeight = minHeight + "px";
  });
};

const wireClickHandlers = (container, eventIndex, onEventClick) => {
  if (!onEventClick) return;
  container.querySelectorAll(".event").forEach((el) => {
    const id = el.getAttribute("data-event-id");
    const event = eventIndex.get(id);
    if (!event) return;
    el.addEventListener("click", () => onEventClick(event));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEventClick(event);
      }
    });
  });
};

// ===== Mobile horizontal swipe + day dots =====
const renderDayDots = (dotsContainer, days, todayKey) => {
  if (!dotsContainer) return;
  if (!days.length) {
    dotsContainer.innerHTML = "";
    return;
  }
  const dots = days
    .map((day, idx) => {
      const isToday = day === todayKey;
      const label = isToday ? `${day} (aujourd'hui)` : day;
      return `<button type="button" class="day-dot ${isToday ? "today" : ""}" data-day-index="${idx}" aria-label="${escapeHtml(label)}"></button>`;
    })
    .join("");
  dotsContainer.innerHTML = dots;
};

const wireSwipeNavigation = (scheduleContainer, dotsContainer, days, todayKey) => {
  if (!dotsContainer) return;

  const dayGroups = scheduleContainer.querySelectorAll(".day-group");
  const dotEls = dotsContainer.querySelectorAll(".day-dot");

  // Click dot → scroll to that day
  dotEls.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = Number(dot.getAttribute("data-day-index"));
      const target = dayGroups[idx];
      if (!target) return;
      scheduleContainer.scrollTo({
        left: target.offsetLeft,
        behavior: "smooth",
      });
    });
  });

  // Scroll → update active dot
  const updateActive = () => {
    if (!dayGroups.length) return;
    const scrollLeft = scheduleContainer.scrollLeft;
    let bestIdx = 0;
    let bestDistance = Infinity;
    dayGroups.forEach((group, idx) => {
      const distance = Math.abs(group.offsetLeft - scrollLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIdx = idx;
      }
    });
    dotEls.forEach((dot, idx) => {
      dot.classList.toggle("active", idx === bestIdx);
    });
  };

  let scrollRaf = 0;
  scheduleContainer.addEventListener("scroll", () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateActive();
    });
  });

  // Initial scroll: jump to today if present, otherwise first day
  requestAnimationFrame(() => {
    const todayIdx = days.indexOf(todayKey);
    if (todayIdx > 0) {
      const target = dayGroups[todayIdx];
      if (target) scheduleContainer.scrollLeft = target.offsetLeft;
    }
    updateActive();
  });
};

export const renderSchedule = ({
  container,
  events,
  onEventClick,
  dotsContainer,
}) => {
  adjustHoursToFit(events);
  const isMobile = isMobileViewport();

  if (!events.length) {
    container.innerHTML = "<p>Aucun événement pour cette semaine.</p>";
    if (dotsContainer) dotsContainer.innerHTML = "";
    return;
  }

  const grouped = groupEventsByDay(events);
  const days = Array.from(grouped.keys());
  if (days.length === 0) {
    container.innerHTML = "<p>Aucun événement pour cette semaine.</p>";
    if (dotsContainer) dotsContainer.innerHTML = "";
    return;
  }

  const todayKey = formatDateOnly(new Date());
  const eventIndex = new Map();

  const railHtml = isMobile ? "" : renderHourRail();
  const daysHtml = days
    .map((day) => renderDay(day, grouped.get(day), todayKey, eventIndex))
    .join("");

  container.innerHTML = railHtml + daysHtml;

  wireClickHandlers(container, eventIndex, onEventClick);
  adjustDayHeights(container);

  if (isMobile) {
    renderDayDots(dotsContainer, days, todayKey);
    wireSwipeNavigation(container, dotsContainer, days, todayKey);
  } else if (dotsContainer) {
    dotsContainer.innerHTML = "";
  }
};
