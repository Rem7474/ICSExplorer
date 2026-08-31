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
