package ics

import (
	"strings"
	"testing"
)

func TestFormatCalendarLines(t *testing.T) {
	inputLines := []string{
		"BEGIN:VCALENDAR",
		"BEGIN:VEVENT",
		"SUMMARY:HA_Maths_Algebre",
		"LOCATION:A166_CM (V)",
		"DESCRIPTION:1A_Kholle\\n14h\\nDupont M.\\nExport",
		"END:VEVENT",
		"END:VCALENDAR",
	}

	formatted := FormatCalendarLines(inputLines)

	expectedSummary := "SUMMARY:HA Maths Algebre"
	expectedLocation := "LOCATION:A166"
	expectedDesc := "DESCRIPTION:Kholle avec Dupont M., de 14h"

	for _, line := range formatted {
		if strings.HasPrefix(line, "SUMMARY:") && line != expectedSummary {
			t.Errorf("got %q; want %q", line, expectedSummary)
		}
		if strings.HasPrefix(line, "LOCATION:") && line != expectedLocation {
			t.Errorf("got %q; want %q", line, expectedLocation)
		}
		if strings.HasPrefix(line, "DESCRIPTION:") && line != expectedDesc {
			t.Errorf("got %q; want %q", line, expectedDesc)
		}
	}
}

func TestFormatSoutienCourse(t *testing.T) {
	inputLines := []string{
		"SUMMARY:Electronique",
		"DESCRIPTION:3AMEL101_2024_S5_IUT_EL_A1\\nProfesseur Martin\\nExport",
	}

	formatted := FormatCalendarLines(inputLines)
	if len(formatted) < 2 {
		t.Fatalf("unexpected formatted len: %d", len(formatted))
	}

	wantDesc := "DESCRIPTION:Cours de soutien en Electronique avec Professeur Martin, Export"
	if formatted[1] != wantDesc {
		t.Errorf("got %q; want %q", formatted[1], wantDesc)
	}
}

func TestFormatTPTD(t *testing.T) {
	inputLines := []string{
		"SUMMARY:Informatique C++",
		"DESCRIPTION:1AMIF101_2024_S1_TP_A2\\nProfesseur Durand",
	}

	formatted := FormatCalendarLines(inputLines)
	if len(formatted) < 2 {
		t.Fatalf("unexpected formatted len: %d", len(formatted))
	}

	wantDesc := "DESCRIPTION:Informatique C++ en TP2 avec Professeur Durand"
	if formatted[1] != wantDesc {
		t.Errorf("got %q; want %q", formatted[1], wantDesc)
	}
}

func TestUnfoldLines(t *testing.T) {
	raw := []byte("BEGIN:VCALENDAR\r\nSUMMARY:Very Long Su\r\n mmary Line\r\nEND:VCALENDAR")
	unfolded := UnfoldLines(raw)

	if len(unfolded) != 3 {
		t.Fatalf("expected 3 lines, got %d", len(unfolded))
	}
	if unfolded[1] != "SUMMARY:Very Long Summary Line" {
		t.Errorf("unfolding failed: got %q", unfolded[1])
	}
}

func TestFormatCalendarLinesSanitizesAberrantDates(t *testing.T) {
	inputLines := []string{
		"BEGIN:VCALENDAR",
		// 1-year typo event (LV510 style): start year 2026 instead of 2027, same day/month
		"BEGIN:VEVENT",
		"UID:evt-typo-lv510",
		"SUMMARY:LV510",
		"LOCATION:A046 (V)",
		"DESCRIPTION:LV510 en TD4 avec * SACCHETTI Fiona",
		"DTSTART:20260204T091500Z",
		"DTEND:20270204T104500Z",
		"END:VEVENT",
		// Broken 1970 event (MAC50 style)
		"BEGIN:VEVENT",
		"UID:evt-broken-1970",
		"SUMMARY:MAC50",
		"DTSTART:20261122T230000Z",
		"DTEND:19700102T133000Z",
		"END:VEVENT",
		// Broken inverted dates event (TE510 style: end before start)
		"BEGIN:VEVENT",
		"UID:evt-broken-inverted",
		"SUMMARY:TE510",
		"DTSTART:20261123T120000Z",
		"DTEND:20260922T133000Z",
		"END:VEVENT",
		// Normal valid event
		"BEGIN:VEVENT",
		"UID:evt-valid",
		"SUMMARY:Maths",
		"DTSTART:20260918T080000Z",
		"DTEND:20260918T100000Z",
		"END:VEVENT",
		"END:VCALENDAR",
	}

	formatted := FormatCalendarLines(inputLines)
	output := strings.Join(formatted, "\n")

	// Corrupted events must be discarded
	if strings.Contains(output, "evt-broken-1970") {
		t.Errorf("expected 1970 broken event to be discarded")
	}
	if strings.Contains(output, "evt-broken-inverted") {
		t.Errorf("expected inverted dates event to be discarded")
	}

	// Valid event must be retained
	if !strings.Contains(output, "evt-valid") {
		t.Errorf("expected valid event to be retained")
	}

	// Typo event must be auto-corrected (start year updated to 2027)
	if !strings.Contains(output, "evt-typo-lv510") {
		t.Errorf("expected typo event to be retained and corrected")
	}
	if !strings.Contains(output, "DTSTART:20270204T091500Z") {
		t.Errorf("expected DTSTART to be corrected to 20270204T091500Z, got output:\n%s", output)
	}
}
