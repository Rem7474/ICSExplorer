package ade

import (
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
