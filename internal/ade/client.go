package ade

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Client handles HTTP interactions with ADE Campus servers.
type Client struct {
	httpClient      *http.Client
	login           string
	password        string
	academicYear    string
	baseURL         string
	institutionPath string
}

// NewClient creates a new ADE client with authentication and timeout,
// defaulting to the Grenoble INP / ESISAR instance.
func NewClient(login, password, academicYear string) *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
		login:           login,
		password:        password,
		academicYear:    academicYear,
		baseURL:         "https://edt.grenoble-inp.fr",
		institutionPath: "etudiant/esisar",
	}
}

// NewClientForInstitution creates an ADE client targeting an arbitrary ADE Campus
// instance, identified by its base URL and institution path segment (the part of
// the export URL that follows "directCal/{year}/", e.g. "etudiant/esisar").
func NewClientForInstitution(login, password, academicYear, baseURL, institutionPath string) *Client {
	c := NewClient(login, password, academicYear)
	c.SetBaseURL(baseURL)
	c.SetInstitutionPath(institutionPath)
	return c
}

// SetBaseURL overrides the base URL (useful for testing or targeting another institution).
func (c *Client) SetBaseURL(url string) {
	c.baseURL = strings.TrimRight(url, "/")
}

// SetInstitutionPath overrides the institution path segment used in the export URL.
func (c *Client) SetInstitutionPath(path string) {
	c.institutionPath = strings.Trim(path, "/")
}

// makeRequest prepares and sends an authenticated HTTP GET request.
func (c *Client) makeRequest(ctx context.Context, endpoint string) (*http.Response, error) {
	fullURL := endpoint
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		fullURL = fmt.Sprintf("%s/%s", c.baseURL, strings.TrimLeft(endpoint, "/"))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3")

	if c.login != "" && c.password != "" {
		auth := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", c.login, c.password)))
		req.Header.Set("Authorization", "Basic "+auth)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed to %s: %w", fullURL, err)
	}

	return resp, nil
}

// FetchCalendarRaw fetches the raw ICS calendar for given resource ID(s).
func (c *Client) FetchCalendarRaw(ctx context.Context, resourceIDs string) ([]byte, error) {
	// Parse base year from academicYear format "YYYY-YYYY+1"
	parts := strings.Split(c.academicYear, "-")
	baseYear := time.Now().Year()
	if len(parts) > 0 {
		if y, err := strconv.Atoi(parts[0]); err == nil {
			baseYear = y
		}
	}

	startYear := baseYear - 2
	endYear := baseYear + 3

	resourcesParam := ""
	if resourceIDs != "" {
		resourcesParam = "resources=" + resourceIDs + "&"
	}

	endpoint := fmt.Sprintf("directCal/%s/%s?%sstartDay=31&startMonth=08&startYear=%d&endDay=10&endMonth=01&endYear=%d",
		c.academicYear, c.institutionPath, resourcesParam, startYear, endYear)

	resp, err := c.makeRequest(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("ADE returned 401 Unauthorized (invalid credentials)")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ADE returned unexpected status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	return data, nil
}

// FetchTreePage fetches an HTML page from the ADE tree interface.
func (c *Client) FetchTreePage(ctx context.Context, path string) ([]byte, error) {
	resp, err := c.makeRequest(ctx, path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ADE tree returned status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read tree page: %w", err)
	}

	return data, nil
}
