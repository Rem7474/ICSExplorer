package ics

import (
	"testing"
)

func TestFoldLine(t *testing.T) {
	shortLine := "SUMMARY:Short course"
	foldedShort := FoldLine(shortLine)
	if foldedShort != shortLine {
		t.Errorf("expected short line unchanged, got: %s", foldedShort)
	}

	longLine := "DESCRIPTION:This is a very very long line that exceeds the standard RFC 5545 limit of 75 octets and must be folded across multiple lines with leading space."
	foldedLong := FoldLine(longLine)

	unfolded := UnfoldLines([]byte(foldedLong))
	if len(unfolded) != 1 || unfolded[0] != longLine {
		t.Errorf("expected unfold to restore exact original line, got: %v", unfolded)
	}
}

func TestCleanMojibake(t *testing.T) {
	mojibake := "DÃ©jeuner 3A - SoirÃ©e inter-assos Ã€ l'Esisar"
	expected := "Déjeuner 3A - Soirée inter-assos À l'Esisar"
	cleaned := CleanMojibake(mojibake)
	if cleaned != expected {
		t.Errorf("expected %q, got %q", expected, cleaned)
	}
}

func TestEnsureUTF8(t *testing.T) {
	// Latin-1 encoded "Déjeuner" where 'é' is byte 0xE9
	latin1Bytes := []byte{'D', 0xE9, 'j', 'e', 'u', 'n', 'e', 'r'}
	utf8Bytes := EnsureUTF8(latin1Bytes)

	if string(utf8Bytes) != "Déjeuner" {
		t.Errorf("expected %q, got %q", "Déjeuner", string(utf8Bytes))
	}
}
