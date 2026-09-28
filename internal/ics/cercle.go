package ics

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Auxiliary calendars are written next to the student calendars in the output
// directory but are overlays (merged by the frontend), not selectable schedules.
const (
	CercleFileName = "cercle.ics"
	RUFileName     = "ru.ics"
)

// IsAuxiliaryCalendar reports whether name is an overlay calendar that must be
// excluded from schedule listings, health checks and stale-file pruning.
func IsAuxiliaryCalendar(name string) bool {
	return name == CercleFileName || name == RUFileName
}

// FetchCercleCalendar downloads the public Google Calendar ICS for Cercle Esisar.
func FetchCercleCalendar(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create Cercle ICS request: %w", err)
	}

	req.Header.Set("User-Agent", "EDTEsisar-Sync/2.0")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download Cercle ICS: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("cercle calendar returned HTTP %d", resp.StatusCode)
	}

	// Bound the download: a public calendar is a few hundred KiB at most.
	const maxCercleBytes = 16 << 20
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxCercleBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxCercleBytes {
		return nil, fmt.Errorf("cercle calendar exceeds %d bytes", maxCercleBytes)
	}
	return data, nil
}

// MergeCercleEvents merges Cercle VEVENT blocks into student calendar data without duplicate UIDs.
func MergeCercleEvents(studentIcsData, cercleIcsData []byte) ([]byte, error) {
	studentLines := UnfoldLines(studentIcsData)
	cercleLines := UnfoldLines(cercleIcsData)

	cercleEvents := ExtractVEvents(cercleLines)
	if len(cercleEvents) == 0 {
		return studentIcsData, nil
	}

	// Collect existing UIDs in student calendar to avoid duplication
	existingUIDs := make(map[string]bool)
	for _, line := range studentLines {
		if strings.HasPrefix(line, "UID:") {
			existingUIDs[strings.TrimPrefix(line, "UID:")] = true
		}
	}

	// Filter out existing Cercle events and tag them with source metadata
	var eventsToAdd [][]string
	for _, ev := range cercleEvents {
		var uid string
		hasCategories := false
		var taggedEv []string

		for _, line := range ev {
			if strings.HasPrefix(line, "UID:") {
				uid = strings.TrimPrefix(line, "UID:")
			}
			if strings.HasPrefix(line, "CATEGORIES:") {
				hasCategories = true
			}
			if strings.EqualFold(line, "END:VEVENT") {
				if !hasCategories {
					taggedEv = append(taggedEv, "CATEGORIES:CERCLE")
				}
				taggedEv = append(taggedEv, "X-SOURCE:Cercle Esisar")
			}
			taggedEv = append(taggedEv, line)
		}

		if uid == "" || !existingUIDs[uid] {
			eventsToAdd = append(eventsToAdd, taggedEv)
		}
	}

	if len(eventsToAdd) == 0 {
		return studentIcsData, nil
	}

	// Insert events before "END:VCALENDAR"
	var outputLines []string
	endInserted := false

	for _, line := range studentLines {
		if strings.EqualFold(line, "END:VCALENDAR") && !endInserted {
			for _, ev := range eventsToAdd {
				outputLines = append(outputLines, ev...)
			}
			endInserted = true
		}
		outputLines = append(outputLines, line)
	}

	if !endInserted {
		for _, ev := range eventsToAdd {
			outputLines = append(outputLines, ev...)
		}
		outputLines = append(outputLines, "END:VCALENDAR")
	}

	return []byte(JoinLines(outputLines)), nil
}
