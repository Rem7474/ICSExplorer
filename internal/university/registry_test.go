package university

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func mockPortal(handler http.HandlerFunc) *httptest.Server {
	return httptest.NewServer(handler)
}

func staticPortalBody(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, `
		<html><body>
		<a href="https://ade.example.org/2025-2026/etudiant/esisar">Etudiants Esisar 2025-2026</a>
		<a href="https://ade.example.org/2026-2027/etudiant/esisar">Etudiants Esisar 2026-2027</a>
		<a href="https://ade.example.org/2025-2026/etudiant/ense3">Etudiants Ense3 2025-2026</a>
		</body></html>
	`)
}

func TestDirectoryListDiscoversUniversitiesFromPortal(t *testing.T) {
	portal := mockPortal(staticPortalBody)
	defer portal.Close()

	dir := NewDirectory([]Deployment{{Slug: "test", RootURL: portal.URL, BaseURL: "https://ade.example.org"}}, time.Hour)

	list, err := dir.List(context.Background())
	if err != nil {
		t.Fatalf("expected success, got: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 deduplicated universities, got %d: %+v", len(list), list)
	}

	u, ok := dir.Find(context.Background(), "test-esisar")
	if !ok {
		t.Fatal("expected to find test-esisar")
	}
	if u.Name != "Esisar" || u.InstitutionPath != "etudiant/esisar" || u.BaseURL != "https://ade.example.org" {
		t.Errorf("unexpected university: %+v", u)
	}
}

func TestDirectoryFindUnknown(t *testing.T) {
	portal := mockPortal(staticPortalBody)
	defer portal.Close()

	dir := NewDirectory([]Deployment{{Slug: "test", RootURL: portal.URL, BaseURL: "https://ade.example.org"}}, time.Hour)

	if _, ok := dir.Find(context.Background(), "does-not-exist"); ok {
		t.Error("expected Find to return false for an unknown ID")
	}
}

func TestDirectoryServesStaleCacheWhenDiscoveryFails(t *testing.T) {
	callCount := 0
	portal := mockPortal(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			staticPortalBody(w, r)
			return
		}
		w.WriteHeader(http.StatusInternalServerError)
	})
	defer portal.Close()

	// ttl=0 forces a refresh attempt on every List() call.
	dir := NewDirectory([]Deployment{{Slug: "test", RootURL: portal.URL, BaseURL: "https://ade.example.org"}}, 0)

	list, err := dir.List(context.Background())
	if err != nil || len(list) != 2 {
		t.Fatalf("expected initial discovery to succeed with 2 entries, got %v / err=%v", list, err)
	}

	list2, err := dir.List(context.Background())
	if err != nil {
		t.Fatalf("expected fallback to cached list, got error: %v", err)
	}
	if len(list2) != 2 {
		t.Errorf("expected cached fallback list of 2, got %d", len(list2))
	}
}

func TestDirectoryReturnsErrorWhenNoCacheAndDiscoveryFails(t *testing.T) {
	portal := mockPortal(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	defer portal.Close()

	dir := NewDirectory([]Deployment{{Slug: "test", RootURL: portal.URL, BaseURL: "https://ade.example.org"}}, time.Hour)

	if _, err := dir.List(context.Background()); err == nil {
		t.Error("expected an error when discovery fails and no cache is available")
	}
}
