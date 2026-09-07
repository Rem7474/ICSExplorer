package ade

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/Rem7474/ICSExplorer/internal/ics"
)

// Resource represents a promo, student group, or room schedule in ADE.
type Resource struct {
	Name   string
	ID     string
	IsRoom bool
}

// Regex patterns for ADE tree crawling.
// Note the \s*-\s* pattern to tolerate spaces around hyphens in branch labels.
var (
	BranchRegex = regexp.MustCompile(`(?i)(?:[1-5]\s*-\s*[a-zA-Z]|[1-5]A|Etudiants|Esisar|TD)`)
	LeafRegex   = regexp.MustCompile(`(?i)([1-5]A|ESE|ISC|ISE|IR|M2-IMESS|Prépa|PINP|HN|APP|Special)`)
)

// Crawler crawls the ADE tree to discover all promo and class resources.
type Crawler struct {
	client       *Client
	academicYear string
	visitedCodes map[string]bool
}

// NewCrawler creates a new ADE tree crawler.
func NewCrawler(client *Client, academicYear string) *Crawler {
	return &Crawler{
		client:       client,
		academicYear: academicYear,
		visitedCodes: make(map[string]bool),
	}
}

// DiscoverResources crawls the ADE tree dynamically.
func (c *Crawler) DiscoverResources(ctx context.Context) ([]Resource, error) {
	c.visitedCodes = make(map[string]bool)

	// Step 1: Initial tree page request
	initPath := fmt.Sprintf("%s/esisar/etudiant/jsp/standard/gui/tree.jsp?category=trainee&expand=true&forceLoad=false&reload=false&scroll=0", c.academicYear)
	content, err := c.client.FetchTreePage(ctx, initPath)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch initial tree page: %w", err)
	}

	// Extract initial branch codes
	branches, err := c.extractBranches(content)
	if err != nil {
		return nil, err
	}

	for _, branchCode := range branches {
		if err := c.crawlBranch(ctx, branchCode); err != nil {
			// Log and continue rather than aborting the entire discovery
			continue
		}
	}

	// Crawl trainee branch if not already visited
	_ = c.crawlBranch(ctx, "trainee")

	// Final step: fetch the fully expanded tree page to collect all leaf resources
	finalPath := fmt.Sprintf("%s/esisar/etudiant/jsp/standard/gui/tree.jsp", c.academicYear)
	finalContent, err := c.client.FetchTreePage(ctx, finalPath)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch final tree page: %w", err)
	}

	return c.extractLeaves(finalContent)
}

func (c *Crawler) crawlBranch(ctx context.Context, branchCode string) error {
	if c.visitedCodes[branchCode] {
		return nil
	}
	c.visitedCodes[branchCode] = true

	path := fmt.Sprintf("%s/esisar/etudiant/jsp/standard/gui/tree.jsp?branchId=%s&expand=false&forceLoad=false&reload=false&scroll=0", c.academicYear, branchCode)
	content, err := c.client.FetchTreePage(ctx, path)
	if err != nil {
		return err
	}

	branches, err := c.extractBranches(content)
	if err != nil {
		return err
	}

	for _, b := range branches {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			_ = c.crawlBranch(ctx, b)
		}
	}

	return nil
}

func (c *Crawler) extractBranches(htmlContent []byte) ([]string, error) {
	htmlContent = ics.EnsureUTF8(htmlContent)
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML tree: %w", err)
	}

	var branchCodes []string
	doc.Find("span.treebranch a").Each(func(i int, s *goquery.Selection) {
		text := strings.TrimSpace(s.Text())
		if BranchRegex.MatchString(text) {
			href, exists := s.Attr("href")
			if exists && strings.Contains(href, "checkBranch(") {
				code := extractBranchCode(href)
				if code != "" {
					branchCodes = append(branchCodes, code)
				}
			}
		}
	})

	return branchCodes, nil
}

func (c *Crawler) extractLeaves(htmlContent []byte) ([]Resource, error) {
	htmlContent = ics.EnsureUTF8(htmlContent)
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(htmlContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse final HTML tree: %w", err)
	}

	var resources []Resource
	seen := make(map[string]bool)

	doc.Find("div.treeline span a").Each(func(i int, s *goquery.Selection) {
		text := strings.TrimSpace(s.Text())
		if text != "" && LeafRegex.MatchString(text) {
			href, exists := s.Attr("href")
			if exists && strings.Contains(href, "(") {
				// Exclude branch triggers: branches are folders, not calendar resources,
				// and cause HTTP 500 when requested via directCal.
				if strings.Contains(href, "checkBranch") || strings.Contains(href, "openBranch") {
					return
				}
				if s.Parent().HasClass("treebranch") || s.HasClass("treebranch") {
					return
				}

				id := extractResourceID(href)
				if id != "" && !seen[text] {
					seen[text] = true
					resources = append(resources, Resource{
						Name:   text,
						ID:     id,
						IsRoom: false,
					})
				}
			}
		}
	})

	return resources, nil
}

// extractBranchCode parses "checkBranch('1234', ...)" -> "1234"
func extractBranchCode(href string) string {
	parts := strings.Split(href, "checkBranch(")
	if len(parts) < 2 {
		return ""
	}
	subParts := strings.Split(parts[1], ",")
	if len(subParts) < 1 {
		return ""
	}
	return strings.Trim(subParts[0], "'\" ")
}

// extractResourceID parses "checkTree('1234', ...)" or "selectLeaf('1234', ...)" -> "1234"
func extractResourceID(href string) string {
	idx := strings.Index(href, "(")
	if idx == -1 {
		return ""
	}
	sub := href[idx+1:]
	parts := strings.Split(sub, ",")
	if len(parts) < 1 {
		return ""
	}
	return strings.Trim(parts[0], "'\" )")
}

// LoadStaticIDs loads resources from a semicolon or comma-separated file (e.g. IDS.txt or Rooms-IDS.txt).
// It automatically converts content to valid UTF-8, handling Latin-1 / ANSI accented characters properly.
func LoadStaticIDs(filePath string, isRoom bool) ([]Resource, error) {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("could not open ID file %s: %w", filePath, err)
	}
	raw = ics.EnsureUTF8(raw)

	var resources []Resource
	scanner := bufio.NewScanner(bytes.NewReader(raw))

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		var name, id string
		if strings.Contains(line, ";") {
			parts := strings.SplitN(line, ";", 2)
			name = strings.TrimSpace(parts[0])
			id = strings.TrimSpace(parts[1])
		} else if strings.Contains(line, ",") {
			parts := strings.SplitN(line, ",", 2)
			name = strings.TrimSpace(parts[0])
			id = strings.TrimSpace(parts[1])
		}

		if name != "" && id != "" {
			resources = append(resources, Resource{
				Name:   name,
				ID:     id,
				IsRoom: isRoom,
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading ID file %s: %w", filePath, err)
	}

	return resources, nil
}

// DefaultRooms returns the default known list of classrooms for Esisar.
func DefaultRooms() []Resource {
	return []Resource{
		{Name: "A042", ID: "9756", IsRoom: true},
		{Name: "A046", ID: "2101", IsRoom: true},
		{Name: "A048", ID: "2895", IsRoom: true},
		{Name: "A049", ID: "9757", IsRoom: true},
		{Name: "A166", ID: "15186", IsRoom: true},
		{Name: "B040", ID: "1796", IsRoom: true},
		{Name: "B042", ID: "2336", IsRoom: true},
		{Name: "B044", ID: "1814", IsRoom: true},
		{Name: "B141", ID: "2757", IsRoom: true},
		{Name: "B148", ID: "1660", IsRoom: true},
		{Name: "B152", ID: "2706", IsRoom: true},
		{Name: "C065", ID: "3096", IsRoom: true},
		{Name: "C080", ID: "2543", IsRoom: true},
	}
}

// SaveStaticIDs writes a list of resources to a semicolon-separated file (e.g. IDS.txt or Rooms-IDS.txt).
func SaveStaticIDs(filePath string, resources []Resource) error {
	cleaned := filepath.Clean(filePath)
	if dir := filepath.Dir(cleaned); dir != "" {
		_ = os.MkdirAll(dir, 0o755)
	}

	var sb strings.Builder
	for _, res := range resources {
		sb.WriteString(fmt.Sprintf("%s;%s\n", res.Name, res.ID))
	}

	return os.WriteFile(cleaned, []byte(sb.String()), 0o644)
}
