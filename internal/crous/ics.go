package crous

import (
	"fmt"
	"strings"
	"time"
)

// GenerateICS converts a slice of FilteredDayMenu into an RFC 5545 compliant iCalendar byte slice.
// startHour, startMin, endHour, endMin define the daily lunch slot (e.g., 12, 0, 13, 0).
func GenerateICS(menus []FilteredDayMenu, startHour, startMin, endHour, endMin int) []byte {
	var lines []string

	lines = append(lines,
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//ICSExplorer//RU BriffO//FR",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:Menu RU Briff'O",
		"X-WR-TIMEZONE:Europe/Paris",
	)

	nowStr := time.Now().UTC().Format("20060102T150405Z")

	for _, menu := range menus {
		// Format DTSTART and DTEND using the target slot
		dateStr := menu.Date.Format("20060102")
		dtStart := fmt.Sprintf("%sT%02d%02d00", dateStr, startHour, startMin)
		dtEnd := fmt.Sprintf("%sT%02d%02d00", dateStr, endHour, endMin)

		uid := fmt.Sprintf("ru-briffo-%s@croustillant", dateStr)

		// Build description
		var descParts []string

		if len(menu.SaveursDuJour) > 0 {
			var part strings.Builder
			part.WriteString("🍽️ Saveurs du Jour :\n")
			for _, item := range menu.SaveursDuJour {
				part.WriteString(fmt.Sprintf("• %s\n", item))
			}
			descParts = append(descParts, strings.TrimRight(part.String(), "\n"))
		}

		if len(menu.Pates) > 0 {
			var part strings.Builder
			part.WriteString("🍝 Pâtes :\n")
			for _, item := range menu.Pates {
				part.WriteString(fmt.Sprintf("• %s\n", item))
			}
			descParts = append(descParts, strings.TrimRight(part.String(), "\n"))
		}

		fullDesc := strings.Join(descParts, "\n\n")

		lines = append(lines,
			"BEGIN:VEVENT",
			fmt.Sprintf("UID:%s", uid),
			fmt.Sprintf("DTSTAMP:%s", nowStr),
			fmt.Sprintf("DTSTART:%s", dtStart),
			fmt.Sprintf("DTEND:%s", dtEnd),
			"SUMMARY:🍽️ RU Briff'O",
			fmt.Sprintf("DESCRIPTION:%s", escapeICS(fullDesc)),
			"LOCATION:RU Briff'O (Valence)",
			"CATEGORIES:RU,CROUS",
			"X-SOURCE:RU Briff'O",
			"END:VEVENT",
		)
	}

	lines = append(lines, "END:VCALENDAR")

	// Join with CRLF per RFC 5545
	return []byte(strings.Join(lines, "\r\n") + "\r\n")
}

// escapeICS escapes special characters for iCalendar text values per RFC 5545.
func escapeICS(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, ";", "\\;")
	s = strings.ReplaceAll(s, ",", "\\,")
	s = strings.ReplaceAll(s, "\r\n", "\\n")
	s = strings.ReplaceAll(s, "\n", "\\n")
	return s
}
