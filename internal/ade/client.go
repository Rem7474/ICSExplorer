package ade

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"strconv"
	"strings"
	"sync"
	"time"
)

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Client handles HTTP interactions with ADE Campus servers.
type Client struct {
	httpClient      *http.Client
	login           string
	password        string
	academicYear    string
	baseURL         string
	institutionPath string

	// ADE Campus (Adesoft/Tomcat) requires a server-side session context - a
	// JSESSIONID cookie plus an internal projectId - to be established via a
	// GET on the institution's entry page before tree.jsp or directCal will
	// serve anything; hitting those endpoints cold returns 404/empty/500
	// responses even with correct Basic Auth credentials. sessionMu guards the
	// one-time initialization per Client instance.
	sessionMu    sync.Mutex
	sessionReady bool
	referer      string
}

// NewClient creates a new ADE client with authentication and timeout,
// defaulting to the Grenoble INP / ESISAR instance.
func NewClient(login, password, academicYear string) *Client {
	jar, _ := cookiejar.New(nil)
	return &Client{
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
			Jar:     jar,
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

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3")
	if c.referer != "" {
		// Adesoft rejects tree/export requests that don't appear to come from
		// its own entry page.
		req.Header.Set("Referer", c.referer)
	}

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

// entryURL returns the institution's ADE Campus "direct planning" page - the
// entryURL returns the institution's ADE Campus entry page (e.g. /2026-2027/etudiant/esisar),
// whose GET establishes the server-side session (JSESSIONID + internal context)
// that tree.jsp and directCal both require.
func (c *Client) entryURL() string {
	return fmt.Sprintf("%s/%s/%s", c.baseURL, c.academicYear, c.institutionPath)
}

// ensureSession establishes the ADE Campus server-side session once per
// Client, by GETing the institution's entry page. Subsequent requests reuse
// the resulting cookies (via the client's cookie jar) and send a matching
// Referer header, both of which ADE Campus expects to see before serving
// tree.jsp or directCal.
func (c *Client) ensureSession(ctx context.Context) error {
	c.sessionMu.Lock()
	defer c.sessionMu.Unlock()

	if c.sessionReady {
		return nil
	}

	entry := c.entryURL()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, entry, nil)
	if err != nil {
		return fmt.Errorf("failed to create session-init request: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)
	if c.login != "" && c.password != "" {
		req.SetBasicAuth(c.login, c.password)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("session init request failed to %s: %w", entry, err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("ADE returned 401 Unauthorized (invalid credentials)")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ADE session init returned unexpected status %d", resp.StatusCode)
	}

	c.referer = entry
	c.sessionReady = true
	return nil
}

// FetchCalendarRaw fetches the raw ICS calendar for given resource ID(s).
func (c *Client) FetchCalendarRaw(ctx context.Context, resourceIDs string) ([]byte, error) {
	if err := c.ensureSession(ctx); err != nil {
		return nil, err
	}

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

	resourcesParam := fmt.Sprintf("resources=%s&", resourceIDs)

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
	if err := c.ensureSession(ctx); err != nil {
		return nil, err
	}

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

// FetchDirectTokenCalendar fetches the iCalendar from an ADE Direct Planning instance
// authenticated via an encrypted data token (e.g. /direct/index.jsp?data=...).
func (c *Client) FetchDirectTokenCalendar(ctx context.Context, dataToken string) ([]byte, error) {
	// 1. Establish session via direct_planning.jsp?data=...
	directPlanningURL := fmt.Sprintf("%s/jsp/custom/modules/plannings/direct_planning.jsp?data=%s", c.baseURL, dataToken)
	req1, err := http.NewRequestWithContext(ctx, http.MethodGet, directPlanningURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create direct planning request: %w", err)
	}
	req1.Header.Set("User-Agent", userAgent)
	resp1, err := c.httpClient.Do(req1)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to ADE direct portal: %w", err)
	}
	resp1.Body.Close()

	// 2. Query anonymous_cal.jsp
	now := time.Now()
	baseYear := now.Year()
	startYear := baseYear - 1
	endYear := baseYear + 2

	calURL := fmt.Sprintf("%s/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=&projectId=0&startDay=01&startMonth=09&startYear=%d&endDay=31&endMonth=08&endYear=%d&calType=ical", c.baseURL, startYear, endYear)
	req2, err := http.NewRequestWithContext(ctx, http.MethodGet, calURL, nil)
	if err != nil {
		return nil, err
	}
	req2.Header.Set("User-Agent", userAgent)
	req2.Header.Set("Referer", directPlanningURL)

	resp2, err := c.httpClient.Do(req2)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch direct calendar: %w", err)
	}
	defer resp2.Body.Close()

	body, err := io.ReadAll(resp2.Body)
	if err != nil {
		return nil, err
	}
	if resp2.StatusCode != http.StatusOK || !strings.Contains(string(body), "BEGIN:VCALENDAR") {
		return nil, fmt.Errorf("ADE direct export returned unexpected status %d", resp2.StatusCode)
	}

	return body, nil
}

