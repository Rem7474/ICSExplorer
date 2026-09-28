package crous

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestParseAndFilterMenus(t *testing.T) {
	sampleResp := APIResponse{
		Success: true,
		Data: []DayMenu{
			{
				Code: 1,
				Date: "28-09-2026",
				Repas: []Repas{
					{
						Type: "midi",
						Categories: []Category{
							{
								Libelle: "Vente a emporter",
								Plats: []Plat{
									{Libelle: "Sandwich jambon"},
								},
							},
							{
								Libelle: "Saveurs du jour",
								Plats: []Plat{
									{Libelle: "curry de légumes"},
									{Libelle: "saucisses de Toulouse"},
								},
							},
							{
								Libelle: "Pâtes",
								Plats: []Plat{
									{Libelle: "penne rigate au pesto"},
								},
							},
						},
					},
				},
			},
			{
				// Day with only vente à emporter (should be ignored)
				Code: 2,
				Date: "29-09-2026",
				Repas: []Repas{
					{
						Type: "midi",
						Categories: []Category{
							{
								Libelle: "Vente a emporter",
								Plats: []Plat{
									{Libelle: "Salade"},
								},
							},
						},
					},
				},
			},
		},
	}

	filtered := parseAndFilterMenus(sampleResp)

	if len(filtered) != 1 {
		t.Fatalf("expected 1 filtered day, got %d", len(filtered))
	}

	day := filtered[0]
	expectedDate, _ := time.Parse("02-01-2006", "28-09-2026")
	if !day.Date.Equal(expectedDate) {
		t.Errorf("expected date %v, got %v", expectedDate, day.Date)
	}

	if len(day.SaveursDuJour) != 2 {
		t.Fatalf("expected 2 saveurs du jour, got %d", len(day.SaveursDuJour))
	}
	if day.SaveursDuJour[0] != "Curry de légumes" {
		t.Errorf("expected capitalized 'Curry de légumes', got '%s'", day.SaveursDuJour[0])
	}
	if day.SaveursDuJour[1] != "Saucisses de Toulouse" {
		t.Errorf("expected 'Saucisses de Toulouse', got '%s'", day.SaveursDuJour[1])
	}

	if len(day.Pates) != 1 {
		t.Fatalf("expected 1 pate dish, got %d", len(day.Pates))
	}
	if day.Pates[0] != "Penne rigate au pesto" {
		t.Errorf("expected 'Penne rigate au pesto', got '%s'", day.Pates[0])
	}
}

func TestGenerateICS(t *testing.T) {
	menus := []FilteredDayMenu{
		{
			Date:          time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC),
			SaveursDuJour: []string{"Curry de légumes", "Riz"},
			Pates:         []string{"Penne Rigate"},
		},
	}

	icsData := GenerateICS(menus, 12, 0, 13, 0)
	icsStr := string(icsData)

	if !strings.Contains(icsStr, "BEGIN:VCALENDAR") || !strings.Contains(icsStr, "END:VCALENDAR") {
		t.Fatal("missing VCALENDAR envelope")
	}

	if !strings.Contains(icsStr, "DTSTART:20260928T120000") {
		t.Error("missing expected DTSTART for 12:00")
	}
	if !strings.Contains(icsStr, "DTEND:20260928T130000") {
		t.Error("missing expected DTEND for 13:00")
	}
	if !strings.Contains(icsStr, "SUMMARY:🍽️ RU Briff'O") {
		t.Error("missing expected SUMMARY")
	}
	if !strings.Contains(icsStr, "Curry de légumes") {
		t.Error("missing dish in description")
	}
	if !strings.Contains(icsStr, "Penne Rigate") {
		t.Error("missing pasta in description")
	}
	if !strings.Contains(icsStr, "CATEGORIES:RU,CROUS") {
		t.Error("missing CATEGORIES")
	}
}

func TestLiveFetchAndGenerate(t *testing.T) {
	// Hits the real CROUStillant API: opt-in only, so CI never depends on a third party.
	if os.Getenv("ICSEXPLORER_LIVE_TESTS") == "" {
		t.Skip("set ICSEXPLORER_LIVE_TESTS=1 to run live API tests")
	}
	client := NewClient("1459")
	menus, err := client.FetchMenu(context.Background())
	if err != nil {
		t.Logf("live fetch warning: %v", err)
		return
	}
	if len(menus) == 0 {
		t.Log("no menus found (possibly weekend or off-season)")
		return
	}
	icsData := GenerateICS(menus, 12, 0, 13, 0)
	if len(icsData) == 0 {
		t.Fatal("generated ICS is empty")
	}
	t.Logf("successfully fetched %d days of menu (%d bytes of ICS)", len(menus), len(icsData))
}
