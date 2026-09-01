package ade

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Institution represents one school ("composante") found on an ADE Campus
// root portal page, e.g. Esisar or Ense3 within the Grenoble INP deployment.
type Institution struct {
	ID   string // path segment used in the export URL, e.g. "esisar"
	Name string // display name, e.g. "Esisar"
}

var (
	yearSuffixRegex      = regexp.MustCompile(`\s+\d{4}-\d{4}$`)
	etudiantsPrefixRegex = regexp.MustCompile(`(?i)^Etudiants\s+`)
)

// DiscoverInstitutions fetches an ADE Campus root portal page (e.g.
// https://edt.grenoble-inp.fr/) and parses the public list of "etudiant/{id}"
// links it exposes, one per school hosted on that server. On Grenoble INP's
// deployment (and typically others), this listing page requires no
// authentication, which lets ICSExplorer discover every school sharing a
// given ADE server automatically instead of requiring one manually
// configured entry per school.
func DiscoverInstitutions(ctx context.Context, rootURL string) ([]Institution, error) {
	httpClient := &http.Client{Timeout: 15 * time.Second}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rootURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create discovery request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("discovery request failed for %s: %w", rootURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("discovery portal %s returned status %d", rootURL, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read discovery portal body: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to parse discovery portal HTML: %w", err)
	}

	seen := make(map[string]string)
	var order []string

	doc.Find(`a[href*="/etudiant/"]`).Each(func(i int, s *goquery.Selection) {
		href, ok := s.Attr("href")
		if !ok {
			return
		}
		idx := strings.LastIndex(href, "/etudiant/")
		if idx == -1 {
			return
		}
		id := href[idx+len("/etudiant/"):]
		id = strings.SplitN(id, "?", 2)[0]
		id = strings.SplitN(id, "#", 2)[0]
		id = strings.TrimRight(id, "/")
		if id == "" {
			return
		}

		if _, exists := seen[id]; !exists {
			seen[id] = cleanInstitutionName(s.Text())
			order = append(order, id)
		}
	})

	institutions := make([]Institution, 0, len(order))
	for _, id := range order {
		institutions = append(institutions, Institution{ID: id, Name: seen[id]})
	}

	return institutions, nil
}

// cleanInstitutionName turns a portal link's raw text (e.g. "Etudiants Ense3
// 2025-2026") into a short display name (e.g. "Ense3").
func cleanInstitutionName(text string) string {
	name := etudiantsPrefixRegex.ReplaceAllString(strings.TrimSpace(text), "")
	name = yearSuffixRegex.ReplaceAllString(name, "")
	return strings.TrimSpace(name)
}
