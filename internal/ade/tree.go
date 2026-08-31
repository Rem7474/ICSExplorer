package ade

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

// TreeNode represents a folder branch or a leaf timetable resource in ADE tree.jsp.
type TreeNode struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IsLeaf   bool   `json:"isLeaf"`
	Category string `json:"category,omitempty"`
}

// FetchTreeNodes retrieves the available branches and leaf resources from ADE tree.jsp
// for a given category ("trainee" by default) or specific branchPath (ancestor branch IDs).
func (c *Client) FetchTreeNodes(ctx context.Context, category string, branchPath []string) ([]TreeNode, error) {
	if category == "" {
		category = "trainee"
	}

	// Handle direct token URLs (e.g. direct?data=...)
	if strings.HasPrefix(c.institutionPath, "direct?data=") {
		dataToken := strings.TrimPrefix(c.institutionPath, "direct?data=")
		return c.fetchDirectTokenTreeNodes(ctx, dataToken, category, branchPath)
	}

	if err := c.ensureSession(ctx); err != nil {
		return nil, err
	}

	// 1. Ensure category is opened in session state
	catPath := fmt.Sprintf("%s/%s/jsp/standard/gui/tree.jsp?category=%s&expand=false&forceLoad=false&reload=false&scroll=0",
		c.academicYear, c.institutionPath, url.QueryEscape(category))
	data, err := c.FetchTreePage(ctx, catPath)
	if err != nil {
		return nil, err
	}

	// 2. Open each branch along the branchPath in sequence
	for _, bID := range branchPath {
		bID = strings.TrimSpace(bID)
		if bID == "" {
			continue
		}
		treePath := fmt.Sprintf("%s/%s/jsp/standard/gui/tree.jsp?branchId=%s&expand=false&forceLoad=false&reload=false&scroll=0",
			c.academicYear, c.institutionPath, url.QueryEscape(bID))
		data, err = c.FetchTreePage(ctx, treePath)
		if err != nil {
			return nil, err
		}
	}

	return ParseTreeHTML(string(data)), nil
}

func (c *Client) fetchDirectTokenTreeNodes(ctx context.Context, dataToken string, category string, branchPath []string) ([]TreeNode, error) {
	// 1. Ensure session
	directPlanningURL := fmt.Sprintf("%s/jsp/custom/modules/plannings/direct_planning.jsp?data=%s", c.baseURL, dataToken)
	req1, err := http.NewRequestWithContext(ctx, http.MethodGet, directPlanningURL, nil)
	if err != nil {
		return nil, err
	}
	req1.Header.Set("User-Agent", userAgent)
	resp1, err := c.httpClient.Do(req1)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to direct portal: %w", err)
	}
	resp1.Body.Close()

	// 2. Open category in session
	catURL := fmt.Sprintf("%s/jsp/standard/gui/tree.jsp?category=%s&expand=false&forceLoad=false&reload=false&scroll=0",
		c.baseURL, url.QueryEscape(category))
	reqCat, err := http.NewRequestWithContext(ctx, http.MethodGet, catURL, nil)
	if err != nil {
		return nil, err
	}
	reqCat.Header.Set("User-Agent", userAgent)
	reqCat.Header.Set("Referer", directPlanningURL)
	respCat, err := c.httpClient.Do(reqCat)
	if err != nil {
		return nil, err
	}
	body, err := io.ReadAll(respCat.Body)
	respCat.Body.Close()
	if err != nil {
		return nil, err
	}

	// 3. Open each branch in branchPath in sequence
	for _, bID := range branchPath {
		bID = strings.TrimSpace(bID)
		if bID == "" {
			continue
		}
		treeURL := fmt.Sprintf("%s/jsp/standard/gui/tree.jsp?branchId=%s&expand=false&forceLoad=false&reload=false&scroll=0",
			c.baseURL, url.QueryEscape(bID))
		reqB, err := http.NewRequestWithContext(ctx, http.MethodGet, treeURL, nil)
		if err != nil {
			return nil, err
		}
		reqB.Header.Set("User-Agent", userAgent)
		reqB.Header.Set("Referer", directPlanningURL)

		respB, err := c.httpClient.Do(reqB)
		if err != nil {
			return nil, err
		}
		body, err = io.ReadAll(respB.Body)
		respB.Body.Close()
		if err != nil {
			return nil, err
		}
	}

	return ParseTreeHTML(string(body)), nil
}

var (
	reBranch = regexp.MustCompile(`(?is)openBranch\(['"]?([0-9]+)['"]?\)[^>]*>.*?<SPAN class="treebranch"><a[^>]*>([^<]+)</a>`)
	reLeaf   = regexp.MustCompile(`(?is)check\(['"]?([0-9]+)['"]?[^>]*\)[^>]*>([^<]+)</a>`)
)

// ParseTreeHTML parses an ADE tree.jsp HTML payload and extracts folders and leaf resources.
func ParseTreeHTML(html string) []TreeNode {
	var nodes []TreeNode
	seen := make(map[string]bool)

	divs := strings.Split(html, "<DIV class=\"treeline\">")
	for _, d := range divs[1:] {
		if m := reBranch.FindStringSubmatch(d); len(m) > 2 {
			id := m[1]
			name := strings.TrimSpace(m[2])
			key := "b:" + id
			if !seen[key] && name != "" {
				seen[key] = true
				nodes = append(nodes, TreeNode{
					ID:     id,
					Name:   name,
					IsLeaf: false,
				})
			}
		} else if m := reLeaf.FindStringSubmatch(d); len(m) > 2 {
			id := m[1]
			name := strings.TrimSpace(m[2])
			key := "l:" + id
			if !seen[key] && name != "" {
				seen[key] = true
				nodes = append(nodes, TreeNode{
					ID:     id,
					Name:   name,
					IsLeaf: true,
				})
			}
		}
	}
	return nodes
}
