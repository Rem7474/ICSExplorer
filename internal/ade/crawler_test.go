package ade

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBranchRegex(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{"1-A", true},
		{"1 - A", true},
		{"1  -  B", true},
		{"2 - A", true},
		{"3 - IS", true},
		{"4 - IR", true},
		{"1A", true},
		{"5A", true},
		{"Etudiants", true},
		{"Esisar", true},
		{"TD", true},
		{"Professeurs", false},
		{"Salles", false},
		{"RandomText", false},
	}

	for _, tt := range tests {
		got := BranchRegex.MatchString(tt.input)
		if got != tt.want {
			t.Errorf("BranchRegex.MatchString(%q) = %v; want %v", tt.input, got, tt.want)
		}
	}
}

func TestExtractBranchAndResourceID(t *testing.T) {
	hrefBranch := "javascript:checkBranch('7434',false,false)"
	gotCode := extractBranchCode(hrefBranch)
	if gotCode != "7434" {
		t.Errorf("extractBranchCode(%q) = %q; want '7434'", hrefBranch, gotCode)
	}

	hrefResource := "javascript:selectLeaf('15388',0)"
	gotID := extractResourceID(hrefResource)
	if gotID != "15388" {
		t.Errorf("extractResourceID(%q) = %q; want '15388'", hrefResource, gotID)
	}
}

func TestLoadStaticIDs(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test-ids.txt")
	content := "1A-Prépa;15388\n2A-Prépa;4858\n# Comment line\n\nRoomA,1001\n"
	if err := os.WriteFile(testFile, []byte(content), 0o644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	resources, err := LoadStaticIDs(testFile, false)
	if err != nil {
		t.Fatalf("LoadStaticIDs() unexpected error: %v", err)
	}

	if len(resources) != 3 {
		t.Fatalf("expected 3 resources, got %d", len(resources))
	}
	if resources[0].Name != "1A-Prépa" || resources[0].ID != "15388" {
		t.Errorf("unexpected resource 0: %+v", resources[0])
	}
	if resources[2].Name != "RoomA" || resources[2].ID != "1001" {
		t.Errorf("unexpected resource 2: %+v", resources[2])
	}
}

func TestExtractLeavesExcludesBranchesAndFixesAccents(t *testing.T) {
	crawler := &Crawler{}

	// Simulated ADE HTML with Latin-1 encoding:
	// - Branch 6975: "3A-Ing\xe9-Etu-S9" (has checkBranch, must be excluded)
	// - Leaf 1001: "1A-Pr\xe9pa-TP1" (has selectLeaf, must be kept and decoded as UTF-8)
	// - Leaf 2001: "3A-IR-IR1" (has checkTree, must be kept)
	latin1HTML := []byte(
		"<html><body>\n" +
			"<div class=\"treeline\"><span class=\"treebranch\"><a href=\"javascript:checkBranch('6975',false,false)\">3A-Ing\xe9-Etu-S9</a></span></div>\n" +
			"<div class=\"treeline\"><span><a href=\"javascript:selectLeaf('1001',0)\">1A-Pr\xe9pa-TP1</a></span></div>\n" +
			"<div class=\"treeline\"><span><a href=\"javascript:checkTree('2001',0)\">3A-IR-IR1</a></span></div>\n" +
			"</body></html>",
	)

	leaves, err := crawler.extractLeaves(latin1HTML)
	if err != nil {
		t.Fatalf("extractLeaves failed: %v", err)
	}

	if len(leaves) != 2 {
		t.Fatalf("expected 2 leaf resources, got %d: %+v", len(leaves), leaves)
	}

	for _, l := range leaves {
		if l.ID == "6975" {
			t.Errorf("branch 6975 was incorrectly included as a leaf resource!")
		}
	}

	foundPrepa := false
	for _, l := range leaves {
		if l.ID == "1001" {
			foundPrepa = true
			if l.Name != "1A-Prépa-TP1" {
				t.Errorf("expected clean UTF-8 '1A-Prépa-TP1', got %q", l.Name)
			}
		}
	}

	if !foundPrepa {
		t.Errorf("expected to find 1001 (1A-Prépa-TP1) in leaves")
	}
}

func TestLoadStaticIDsLatin1Encoding(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test-latin1-ids.txt")
	// "1A-Pr\xe9pa;15388\n" in Latin-1
	latin1Content := []byte("1A-Pr\xe9pa;15388\n3A-Ing\xe9;6975\n")
	if err := os.WriteFile(testFile, latin1Content, 0o644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	resources, err := LoadStaticIDs(testFile, false)
	if err != nil {
		t.Fatalf("LoadStaticIDs unexpected error: %v", err)
	}

	if len(resources) != 2 {
		t.Fatalf("expected 2 resources, got %d", len(resources))
	}
	if resources[0].Name != "1A-Prépa" {
		t.Errorf("expected '1A-Prépa', got %q", resources[0].Name)
	}
	if resources[1].Name != "3A-Ingé" {
		t.Errorf("expected '3A-Ingé', got %q", resources[1].Name)
	}
}
