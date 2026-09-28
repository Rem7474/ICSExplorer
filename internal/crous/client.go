package crous

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode"
)

const (
	// DefaultAPIURL is the base URL template for the CROUStillant menu endpoint.
	DefaultAPIURL = "https://api.croustillant.menu/v1/restaurants/%s/menu"
	// DefaultRestaurantID is the ID for RU Briff'O in Valence.
	DefaultRestaurantID = "1459"
	// UserAgent is the required identifying user agent for CROUStillant API requests.
	UserAgent = "ICSExplorer/2.0 (+https://github.com/Rem7474/ICSExplorer)"
)

// APIResponse represents the top-level JSON response from CROUStillant.
type APIResponse struct {
	Success bool      `json:"success"`
	Data    []DayMenu `json:"data"`
}

// DayMenu represents the menu for a specific date.
type DayMenu struct {
	Code  int64   `json:"code"`
	Date  string  `json:"date"` // e.g. "28-09-2026"
	Repas []Repas `json:"repas"`
}

// Repas represents a meal (e.g. "midi", "soir").
type Repas struct {
	Code       int64      `json:"code"`
	Type       string     `json:"type"` // e.g. "midi"
	Categories []Category `json:"categories"`
}

// Category represents a food station (e.g. "Saveurs du jour", "Pâtes").
type Category struct {
	Code    int64  `json:"code"`
	Libelle string `json:"libelle"`
	Ordre   int    `json:"ordre"`
	Plats   []Plat `json:"plats"`
}

// Plat represents a dish.
type Plat struct {
	Code    int64  `json:"code"`
	Libelle string `json:"libelle"`
	Ordre   int    `json:"ordre"`
}

// FilteredDayMenu holds the extracted dishes for display on a specific date.
type FilteredDayMenu struct {
	Date          time.Time
	SaveursDuJour []string
	Pates         []string
}

// Client interacts with the CROUStillant Open Data API.
type Client struct {
	httpClient   *http.Client
	restaurantID string
	apiURL       string
}

// NewClient creates a new CROUStillant client.
func NewClient(restaurantID string) *Client {
	if restaurantID == "" {
		restaurantID = DefaultRestaurantID
	}
	return &Client{
		httpClient:   &http.Client{Timeout: 15 * time.Second},
		restaurantID: restaurantID,
		apiURL:       DefaultAPIURL,
	}
}

// FetchMenu retrieves the menu from the CROUStillant API and returns filtered meals.
func (c *Client) FetchMenu(ctx context.Context) ([]FilteredDayMenu, error) {
	url := fmt.Sprintf(c.apiURL, c.restaurantID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create CROUStillant request: %w", err)
	}

	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call CROUStillant API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CROUStillant API returned HTTP %d", resp.StatusCode)
	}

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode CROUStillant JSON: %w", err)
	}

	return parseAndFilterMenus(apiResp), nil
}

// parseAndFilterMenus processes the raw API response and keeps only Saveurs du jour & Pâtes.
func parseAndFilterMenus(apiResp APIResponse) []FilteredDayMenu {
	var result []FilteredDayMenu

	for _, day := range apiResp.Data {
		parsedDate, err := time.Parse("02-01-2006", day.Date)
		if err != nil {
			continue
		}

		var saveurs []string
		var pates []string

		for _, repas := range day.Repas {
			// Focus on lunch ("midi") or any available meal
			for _, cat := range repas.Categories {
				catLower := strings.ToLower(cat.Libelle)
				if strings.Contains(catLower, "saveur") {
					for _, plat := range cat.Plats {
						name := cleanDishName(plat.Libelle)
						if name != "" {
							saveurs = append(saveurs, name)
						}
					}
				} else if strings.Contains(catLower, "pâte") || strings.Contains(catLower, "pate") {
					for _, plat := range cat.Plats {
						name := cleanDishName(plat.Libelle)
						if name != "" {
							pates = append(pates, name)
						}
					}
				}
			}
		}

		// Only include days that actually have dishes in either category
		if len(saveurs) > 0 || len(pates) > 0 {
			result = append(result, FilteredDayMenu{
				Date:          parsedDate,
				SaveursDuJour: saveurs,
				Pates:         pates,
			})
		}
	}

	return result
}

// cleanDishName cleans and capitalizes dish names.
func cleanDishName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	runes := []rune(name)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}
