package ics

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	regex1ADefault = regexp.MustCompile(`^1AM[A-Z]{2}\d{3}_\d{4}_S\d_[A-Z]{2}_[A-Z]\d`)
	regex2ADefault = regexp.MustCompile(`^2AM[A-Z]{2}\d{3}_\d{4}_S\d_[A-Z]{2}_[A-Z]\d`)
	regex3AProjet  = regexp.MustCompile(`^3AM[A-Z]{2}\d{3}_\d{4}_S\d_PROJET_[A-Z]\d`)
	regexCommon    = regexp.MustCompile(`^\dA(PP)?((-S\d(-TP\d[A-C])?)|-MISTRE)?$`)
	regexSoutien   = regexp.MustCompile(`^3AM[A-Z]{2}\d{3}_\d{4}_S\d_(IUT_[A-Z]{2}_[A-Z]\d|[A-Z]{2}_CPGE_[A-Z]\d)$`)
	regexInverted  = regexp.MustCompile(`AM[A-Z]{2}\d{3}_\d{4}_S\d_[A-Z ]+_[A-Z]\d`)
)

// FormatCalendarLines cleans up and beautifies SUMMARY, LOCATION and DESCRIPTION in an unfolded iCalendar line slice.
func FormatCalendarLines(lines []string) []string {
	result := make([]string, 0, len(lines))
	var lastSummary string

	for i := 0; i < len(lines); i++ {
		line := lines[i]

		if strings.HasPrefix(line, "SUMMARY:") {
			val := strings.TrimPrefix(line, "SUMMARY:")
			val = strings.ReplaceAll(val, "_", " ")
			lastSummary = val
			result = append(result, "SUMMARY:"+val)

		} else if strings.HasPrefix(line, "LOCATION:") {
			val := strings.TrimPrefix(line, "LOCATION:")
			val = strings.ReplaceAll(val, " (V)", "")
			val = strings.ReplaceAll(val, "_CM", "")
			if val == "A166_CM" {
				val = "A166"
			}
			result = append(result, "LOCATION:"+val)

		} else if strings.HasPrefix(line, "DESCRIPTION:") {
			// Format the description line using our rule engine
			formattedDesc := formatDescriptionLine(line, lastSummary)
			result = append(result, formattedDesc)

		} else {
			result = append(result, line)
		}
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
	if len(course) > 0 && course[0] >= '0' && course[0] <= '9' {
		courseParts := strings.Split(course, "_")

		// Case: 1A
		if strings.HasPrefix(course, "1A") && !regex1ADefault.MatchString(course) {
			if strings.Contains(realCourse, "HA") {
				if len(parts) >= 2 {
					p1 := parts[1]
					if len(p1) > 0 && p1[0] >= '0' && p1[0] <= '9' && len(parts) >= 3 {
						return fmt.Sprintf("DESCRIPTION:Kholle avec %s, de %s", parts[2], p1)
					} else if strings.HasPrefix(p1, "(") {
						return "DESCRIPTION:Kholle avec eleves"
					} else {
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
