package ics

import (
	"bufio"
	"bytes"
	"strings"
	"unicode/utf8"
)

// EnsureUTF8 converts ISO-8859-1 (Latin-1) data to valid UTF-8 and fixes mojibake.
func EnsureUTF8(data []byte) []byte {
	if utf8.Valid(data) {
		return []byte(CleanMojibake(string(data)))
	}

	var buf bytes.Buffer
	for _, b := range data {
		buf.WriteRune(rune(b))
	}
	return []byte(CleanMojibake(buf.String()))
}

// CleanMojibake fixes common double-encoded UTF-8 artifacts.
func CleanMojibake(s string) string {
	replacer := strings.NewReplacer(
		"Ã©", "é",
		"Ã¨", "è",
		"Ã ", "à",
		"Ã¹", "ù",
		"Ã¢", "â",
		"Ãª", "ê",
		"Ã®", "î",
		"Ã´", "ô",
		"Ã»", "û",
		"Ã§", "ç",
		"Ã«", "ë",
		"Ã¯", "ï",
		"Ã‰", "É",
		"Ãˆ", "È",
		"Ã€", "À",
		"Ã‡", "Ç",
		"Ãœ", "Ü",
		"Ã–", "Ö",
		"Ã„", "Ä",
		"â€™", "'",
		"â€œ", "\"",
		"â€", "\"",
		"â€“", "-",
		"â€”", "-",
		"Â°", "°",
	)
	return replacer.Replace(s)
}

// UnfoldLines unfolds RFC 5545 lines (lines starting with space or tab are concatenated to previous line).
func UnfoldLines(data []byte) []string {
	data = EnsureUTF8(data)
	var lines []string
	scanner := bufio.NewScanner(bytes.NewReader(data))

	for scanner.Scan() {
		line := scanner.Text()
		// Remove Windows carriage return
		line = strings.TrimRight(line, "\r")

		if (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) && len(lines) > 0 {
			lines[len(lines)-1] += line[1:]
		} else {
			lines = append(lines, line)
		}
	}

	return lines
}

// FoldLine folds a long RFC 5545 line to a maximum of 75 octets if necessary.
func FoldLine(line string) string {
	if len(line) <= 75 {
		return line
	}

	var sb strings.Builder
	for len(line) > 75 {
		sb.WriteString(line[:75])
		sb.WriteString("\r\n ")
		line = line[75:]
	}
	sb.WriteString(line)
	return sb.String()
}

// JoinLines joins lines into RFC 5545 compliant string with CRLF.
func JoinLines(lines []string) string {
	return strings.Join(lines, "\r\n") + "\r\n"
}

// ExtractVEvents extracts raw VEVENT blocks from an iCalendar string.
func ExtractVEvents(lines []string) [][]string {
	var events [][]string
	var current []string
	inEvent := false

	for _, line := range lines {
		if strings.EqualFold(line, "BEGIN:VEVENT") {
			inEvent = true
			current = []string{line}
		} else if strings.EqualFold(line, "END:VEVENT") && inEvent {
			current = append(current, line)
			events = append(events, current)
			current = nil
			inEvent = false
		} else if inEvent {
			current = append(current, line)
		}
	}

	return events
}
