package ade

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDiscoverInstitutions(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `
			<html><body>
			<a href="https://edt.example.org/2025-2026/etudiant/esisar">Etudiants Esisar 2025-2026</a>
			<a href="https://edt.example.org/2026-2027/etudiant/esisar">Etudiants Esisar 2026-2027</a>
			<a href="https://edt.example.org/2025-2026/etudiant/ense3">Etudiants Ense3 2025-2026</a>
			<a href="https://edt.example.org/2025-2026">Emploi du temps 2025-2026</a>
			<a href="https://edt.example.org/2025-2026/enseignant/aip">Utilisateurs S-MART 2025-2026</a>
			</body></html>
		`)
	}))
	defer mockServer.Close()

	institutions, err := DiscoverInstitutions(context.Background(), mockServer.URL)
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}

	if len(institutions) != 2 {
		t.Fatalf("expected 2 deduplicated institutions, got %d: %+v", len(institutions), institutions)
	}

	byID := map[string]string{}
	for _, inst := range institutions {
		byID[inst.ID] = inst.Name
	}

	if byID["esisar"] != "Esisar" {
		t.Errorf("expected esisar name to be cleaned to 'Esisar', got %q", byID["esisar"])
	}
	if byID["ense3"] != "Ense3" {
		t.Errorf("expected ense3 name to be cleaned to 'Ense3', got %q", byID["ense3"])
	}
	if _, found := byID["aip"]; found {
		t.Error("teacher ('enseignant/') links should not be treated as student institutions")
	}
}

func TestDiscoverInstitutionsHTTPError(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer mockServer.Close()

	if _, err := DiscoverInstitutions(context.Background(), mockServer.URL); err == nil {
		t.Fatal("expected an error for a non-200 discovery response")
	}
}
