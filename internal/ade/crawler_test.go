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
	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
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
