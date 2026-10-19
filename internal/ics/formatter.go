package ics

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

var (
	regex1ADefault = regexp.MustCompile(`^1AM[A-Z]{2}\d{3}_\d{4}_S\d_[A-Z]{2}_[A-Z]\d`)
	regex2ADefault = regexp.MustCompile(`^2AM[A-Z]{2}\d{3}_\d{4}_S\d_[A-Z]{2}_[A-Z]\d`)
	regex3AProjet  = regexp.MustCompile(`^3AM[A-Z]{2}\d{3}_\d{4}_S\d_PROJET_[A-Z]\d`)
	regexCommon    = regexp.MustCompile(`^\dA(PP)?((-S\d(-TP\d[ABC])?)|-MISTRE)?$`)
	regexSoutien   = regexp.MustCompile(`^3AM[A-Z]{2}\d{3}_\d{4}_S\d_(IUT_[A-Z]{2}_[A-Z]\d|[A-Z]{2}_CPGE_[A-Z]\d)$`)
	regexInverted  = regexp.MustCompile(`AM[A-Z]{2}\d{3}_\d{4}_S\d_[A-Z ]+_[A-Z]\d`)

	// ExportStampRegex matches the "(Exporté le:12/10/2026 20:32)" trailer ADE appends to every event
	// description. It is kept in the text (readers use it to tell how fresh a schedule is) and only parsed here.
	ExportStampRegex = regexp.MustCompile(`(?i)\(Export[ée]e? le\s*:\s*(\d{1,2}/\d{1,2}/\d{4})(?:\s+(\d{1,2}:\d{2}))?\s*\)`)
)

// LatestExportStamp returns the most recent ADE export time found in raw calendar data, or the zero
// time when none is present. It tells how fresh the data ADE served really is.
func LatestExportStamp(data []byte) time.Time {
	var latest time.Time
	for _, m := range ExportStampRegex.FindAllSubmatch(data, -1) {
		clock := string(m[2])
		if clock == "" {
			clock = "00:00"
		}
		t, err := time.Parse("2/1/2006 15:04", string(m[1])+" "+clock)
		if err == nil && t.After(latest) {
			latest = t
		}
	}
	return latest
}

func parseIcsDateTime(val string) (time.Time, bool) {
	val = strings.TrimSpace(val)
	val = strings.TrimSuffix(val, "\r")
	if idx := strings.LastIndex(val, ":"); idx != -1 {
		val = val[idx+1:]
	}
	layouts := []string{
		"20060102T150405Z",
		"20060102T150405",
		"20060102",
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, val); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// FormatCalendarLines cleans up and beautifies SUMMARY, LOCATION and DESCRIPTION in an unfolded iCalendar line slice,
// while sanitizing aberrant dates (e.g. 1-year ADE typos) and discarding corrupted events (end <= start or 1970 epoch).
// The text rewriting follows Grenoble INP / Esisar naming conventions.
func FormatCalendarLines(lines []string) []string {
	return processCalendarLines(lines, true)
}

// SanitizeCalendarLines applies only the institution-agnostic part of
// FormatCalendarLines: aberrant dates are fixed or dropped, but event text is
// left untouched. Use it for calendars of institutions other than Esisar.
func SanitizeCalendarLines(lines []string) []string {
	return processCalendarLines(lines, false)
}

func updateEventDateLine(lines []string, lineIdx int, t time.Time) {
	if lineIdx < 0 || lineIdx >= len(lines) {
		return
	}
	oldLine := lines[lineIdx]
	colonIdx := strings.Index(oldLine, ":")
	if colonIdx == -1 {
		return
	}
	prefix := oldLine[:colonIdx+1]
	origVal := strings.TrimSpace(oldLine[colonIdx+1:])
	var formatted string
	switch {
	case strings.HasSuffix(origVal, "Z"):
		formatted = t.UTC().Format("20060102T150405Z")
	case strings.Contains(origVal, "T"):
		formatted = t.Format("20060102T150405")
	default:
		formatted = t.Format("20060102")
	}
	lines[lineIdx] = prefix + formatted
}

func processCalendarLines(lines []string, prettify bool) []string {
	result := make([]string, 0, len(lines))
	var lastSummary string

	var inEvent bool
	var eventLines []string
	dtStartIdx := -1
	dtEndIdx := -1
	var dtStartVal, dtEndVal string

	flushEvent := func() {
		if len(eventLines) == 0 {
			return
		}
		// Validate event dates if present
		if dtStartVal != "" && dtEndVal != "" {
			s, sOk := parseIcsDateTime(dtStartVal)
			e, eOk := parseIcsDateTime(dtEndVal)
			if sOk && eOk {
				// Reject events with invalid years (e.g. Unix epoch 1970)
				if s.Year() < 2000 || e.Year() < 2000 {
					return
				}

				// 1. Auto-correct 1-year end date typo from ADE:
				// e.g. DTSTART: 2027-01-15 08:00, DTEND: 2026-01-15 10:00 (end year was typed as previous year)
				if s.Year() == e.Year()+1 {
					correctedEnd := e.AddDate(1, 0, 0)
					if correctedEnd.After(s) {
						e = correctedEnd
						updateEventDateLine(eventLines, dtEndIdx, e)
					}
				}

				// 2. Auto-correct 1-year start date typo from ADE:
				// e.g. DTSTART: 2026-02-04 09:15, DTEND: 2027-02-04 10:45 (start year was typed as previous year)
				if e.Year() == s.Year()+1 {
					correctedStart := s.AddDate(1, 0, 0)
					if e.After(correctedStart) {
						s = correctedStart
						updateEventDateLine(eventLines, dtStartIdx, s)
					}
				}

				// 3. Auto-correct multi-day course corrupted span:
				// In ADE, a course on day s (e.g. 12:30) was scheduled with end date on a later day e (e.g. 14:15).
				// If e is after s and the slot duration within the day is normal (15 min to 8 hours), set e to be on s's day.
				sDate := s.Format("20060102")
				eDate := e.Format("20060102")
				if sDate != eDate && e.After(s) {
					sTime := s.Hour()*60 + s.Minute()
					eTime := e.Hour()*60 + e.Minute()
					slotDur := eTime - sTime
					if slotDur > 0 && slotDur <= 8*60 && sTime >= 6*60 {
						correctedEnd := time.Date(s.Year(), s.Month(), s.Day(), e.Hour(), e.Minute(), e.Second(), e.Nanosecond(), e.Location())
						if correctedEnd.After(s) {
							e = correctedEnd
							updateEventDateLine(eventLines, dtEndIdx, e)
						}
					}
				}

				// Discard if still inverted or identical
				if !e.After(s) {
					return
				}

				// Discard aberrant continuous durations (> 30 days)
				if e.Sub(s) > 30*24*time.Hour {
					return
				}
			}
		}

		result = append(result, eventLines...)
	}

	for i := 0; i < len(lines); i++ {
		line := lines[i]

		if line == "BEGIN:VEVENT" {
			if inEvent {
				flushEvent()
			}
			inEvent = true
			eventLines = []string{line}
			dtStartIdx = -1
			dtEndIdx = -1
			dtStartVal, dtEndVal = "", ""
			lastSummary = ""
			continue
		}

		// Line formatting for SUMMARY, LOCATION, DESCRIPTION
		switch {
		case !prettify:
		case strings.HasPrefix(line, "SUMMARY:"):
			val := strings.TrimPrefix(line, "SUMMARY:")
			val = strings.ReplaceAll(val, "_", " ")
			lastSummary = val
			line = "SUMMARY:" + val

		case strings.HasPrefix(line, "LOCATION:"):
			val := strings.TrimPrefix(line, "LOCATION:")
			val = strings.ReplaceAll(val, " (V)", "")
			val = strings.ReplaceAll(val, "_CM", "")
			if val == "A166_CM" {
				val = "A166"
			}
			line = "LOCATION:" + val

		case strings.HasPrefix(line, "DESCRIPTION:"):
			line = formatDescriptionLine(line, lastSummary)
		}

		if inEvent {
			if strings.HasPrefix(line, "DTSTART") {
				dtStartIdx = len(eventLines)
				if idx := strings.Index(line, ":"); idx != -1 {
					dtStartVal = line[idx+1:]
				}
			} else if strings.HasPrefix(line, "DTEND") {
				dtEndIdx = len(eventLines)
				if idx := strings.Index(line, ":"); idx != -1 {
					dtEndVal = line[idx+1:]
				}
			}

			eventLines = append(eventLines, line)

			if line == "END:VEVENT" {
				inEvent = false
				flushEvent()
				eventLines = nil
			}
			continue
		}

		result = append(result, line)
	}

	if inEvent {
		flushEvent()
	}

	return result
}

// formatDescriptionLine parses and beautifies the DESCRIPTION string.
func formatDescriptionLine(descLine, realCourse string) string {
	// Handle escaped newlines (\n or \\n)
	cleanContent := strings.TrimPrefix(descLine, "DESCRIPTION:")
	cleanContent = strings.ReplaceAll(cleanContent, "\\n", "\n")
	rawParts := strings.Split(cleanContent, "\n")

	var parts []string
	for _, p := range rawParts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}

	if len(parts) < 2 {
		return descLine
	}

	course := parts[0]

	// Check if course starts with digit (e.g. 1A..., 2A..., 3A...)
	if course != "" && course[0] >= '0' && course[0] <= '9' {
		courseParts := strings.Split(course, "_")

		// Case: 1A
		if strings.HasPrefix(course, "1A") && !regex1ADefault.MatchString(course) {
			if strings.Contains(realCourse, "HA") {
				if len(parts) >= 2 {
					p1 := parts[1]
					switch {
					case p1 != "" && p1[0] >= '0' && p1[0] <= '9' && len(parts) >= 3:
						return fmt.Sprintf("DESCRIPTION:Kholle avec %s, de %s", parts[2], p1)
					case strings.HasPrefix(p1, "("):
						return "DESCRIPTION:Kholle avec eleves"
					default:
						return fmt.Sprintf("DESCRIPTION:Kholle avec %s", p1)
					}
				}
			}
			return fmt.Sprintf("DESCRIPTION:%s", course)
		}

		// Case: 2A non-default
		if strings.HasPrefix(course, "2A") && !regex2ADefault.MatchString(course) {
			return fmt.Sprintf("DESCRIPTION:%s", course)
		}

		// Case: 3A Projet
		if strings.HasPrefix(course, "3A") && regex3AProjet.MatchString(course) {
			if len(courseParts) >= 4 && len(parts) >= 3 {
				return fmt.Sprintf("DESCRIPTION:%s en %s avec %s", realCourse, courseParts[3], parts[2])
			}
		}

		// Case: Common class names (3A, 3A-S4, 4APP...)
		if regexCommon.MatchString(course) {
			if len(parts) >= 2 {
				return fmt.Sprintf("DESCRIPTION:%s", strings.Join(parts, ", "))
			}
		}

		// Case: Soutien IUT / CPGE
		if regexSoutien.MatchString(course) {
			if len(parts) >= 2 {
				teachers := strings.Join(parts[1:], ", ")
				return fmt.Sprintf("DESCRIPTION:Cours de soutien en %s avec %s", realCourse, teachers)
			}
		}

		// Default structured case (e.g. 1AMMA101_2020_S1_TP_A1)
		if len(courseParts) == 5 && len(parts) >= 2 {
			courseType := courseParts[3]
			group := courseParts[4]
			teachers := strings.Join(parts[1:], ", ")

			if (courseType == "TP" || courseType == "TD") && len(group) > 1 {
				return fmt.Sprintf("DESCRIPTION:%s en %s%s avec %s", realCourse, courseType, group[1:], teachers)
			}
			return fmt.Sprintf("DESCRIPTION:%s en %s avec %s", realCourse, courseType, teachers)
		}

	} else if len(parts) >= 2 && regexInverted.MatchString(parts[1]) {
		// Inverted pattern case
		invParts := strings.Split(parts[1], "_")
		if len(invParts) >= 4 {
			return fmt.Sprintf("DESCRIPTION:%s en %s avec %s", realCourse, invParts[3], parts[0])
		}
	}

	return descLine
}
