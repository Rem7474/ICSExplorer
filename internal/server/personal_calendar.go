package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/ade"
	"github.com/Rem7474/ICSExplorer/internal/ics"
	"github.com/Rem7474/ICSExplorer/internal/netsafe"
)

// maxPersonalCalendarBodyBytes bounds the request body size for /api/tree and /api/personal-calendar.
const maxPersonalCalendarBodyBytes = 16384

// maxBranchPathLen bounds branchPath: each entry costs one upstream request.
const maxBranchPathLen = 16

var (
	nodeIDRegex   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)
	categoryRegex = regexp.MustCompile(`^[A-Za-z]{0,32}$`)
)

type personalCalendarRequest struct {
	UniversityID string   `json:"universityId"`
	ADEURL       string   `json:"adeUrl"`
	ResourceID   string   `json:"resourceId"`
	BranchPath   []string `json:"branchPath"`
	Login        string   `json:"login"`
	Password     string   `json:"password"`
}

type treeRequest struct {
	UniversityID string   `json:"universityId"`
	ADEURL       string   `json:"adeUrl"`
	BranchID     string   `json:"branchId"`
	BranchPath   []string `json:"branchPath"`
	Category     string   `json:"category"`
	Login        string   `json:"login"`
	Password     string   `json:"password"`
}

// adeTarget is the resolved ADE instance a request should be sent to.
type adeTarget struct {
	baseURL         string
	academicYear    string
	institutionPath string
	resourceID      string // from a pasted URL, if any
}

// requestError carries an HTTP status and a client-safe message.
type requestError struct {
	status int
	msg    string
}

func (e *requestError) Error() string { return e.msg }

func badRequest(msg string) *requestError {
	return &requestError{status: http.StatusBadRequest, msg: msg}
}

// decodeJSONRequest enforces POST + application/json and decodes a bounded body.
// Requiring application/json forces a CORS preflight for cross-origin callers,
// which fails since these endpoints do not send CORS headers.
func decodeJSONRequest(w http.ResponseWriter, r *http.Request, dst any) bool {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "method not allowed")
		return false
	}
	if mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type")); err != nil || mediaType != "application/json" {
		writeJSONError(w, http.StatusUnsupportedMediaType, "Content-Type must be application/json")
		return false
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, maxPersonalCalendarBodyBytes)).Decode(dst); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return false
	}
	return true
}

// validateBranchPath trims and checks every entry of a branch path.
func validateBranchPath(path []string) ([]string, error) {
	if len(path) > maxBranchPathLen {
		return nil, badRequest("branchPath is too long")
	}
	cleaned := make([]string, 0, len(path))
	for _, id := range path {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if !nodeIDRegex.MatchString(id) {
			return nil, badRequest("invalid branchPath entry")
		}
		cleaned = append(cleaned, id)
	}
	return cleaned, nil
}

// resolveTarget maps a request to an ADE instance, either from the university
// registry or from a user-pasted URL. A pasted URL must satisfy the server's
// upstream network policy (public HTTPS host only).
func (s *Server) resolveTarget(ctx context.Context, universityID, adeURL, login, password string) (adeTarget, error) {
	if universityID == "" && adeURL == "" {
		return adeTarget{}, badRequest("either universityId or adeUrl is required")
	}
	// Universities from the registry are only known to use Basic Auth (see
	// internal/ade/client.go), so a login/password is mandatory for that path.
	// A pasted adeUrl may already embed its own access token (some ADE Campus
	// deployments hand out self-authenticating "direct access" links), in which
	// case no separate credentials are needed.
	if universityID != "" && adeURL == "" && (login == "" || password == "") {
		return adeTarget{}, badRequest("login and password are required for this university")
	}

	if adeURL != "" {
		baseURL, academicYear, institutionPath, resourceID, err := ade.ParseInstanceURL(adeURL)
		if err != nil {
			return adeTarget{}, badRequest("could not recognize this as an ADE URL: " + err.Error())
		}
		u, err := url.Parse(baseURL)
		if err != nil {
			return adeTarget{}, badRequest("invalid ADE URL")
		}
		if err := s.upstreamPolicy.ValidateURL(u); err != nil {
			return adeTarget{}, badRequest("this ADE URL is not allowed: it must be a public https:// address")
		}
		if !ade.ValidResourceIDs(resourceID) {
			return adeTarget{}, badRequest("invalid resource ID in ADE URL")
		}
		return adeTarget{baseURL, academicYear, institutionPath, resourceID}, nil
	}

	uni, ok := s.universityDirectory.Find(ctx, universityID)
	if !ok {
		return adeTarget{}, badRequest("unknown university")
	}
	return adeTarget{uni.BaseURL, s.cfg.AcademicYear, uni.InstitutionPath, ""}, nil
}

// newUpstreamClient builds an ADE client for a resolved target, enforcing the
// upstream network policy on every connection and redirect.
func (s *Server) newUpstreamClient(t adeTarget, login, password string) *ade.Client {
	client := ade.NewClientForInstitution(login, password, t.academicYear, t.baseURL, t.institutionPath)
	client.UseNetworkPolicy(s.upstreamPolicy)
	return client
}

// writeUpstreamError maps an ADE client error to a client-safe HTTP response.
func (s *Server) writeUpstreamError(w http.ResponseWriter, err error, resourceIDMissing bool) {
	switch {
	case errors.Is(err, netsafe.ErrBlockedDestination):
		writeJSONError(w, http.StatusBadRequest, "this ADE URL is not allowed: it must be a public https:// address")
	case errors.Is(err, ade.ErrInvalidResourceIDs):
		writeJSONError(w, http.StatusBadRequest, "invalid resource ID")
	case strings.Contains(err.Error(), "401"):
		writeJSONError(w, http.StatusUnauthorized, "invalid credentials")
	case resourceIDMissing && strings.Contains(err.Error(), "500"):
		writeJSONError(w, http.StatusBadRequest, "this ADE server requires a resource ID to identify your calendar - find yours via the ADE web planning view and provide it (or paste a URL that already includes '?resources=...')")
	default:
		writeJSONError(w, http.StatusBadGateway, "could not reach the university's ADE server")
	}
}

// writeRequestError writes err as a JSON error, defaulting to 400.
func writeRequestError(w http.ResponseWriter, err error) {
	var re *requestError
	if errors.As(err, &re) {
		writeJSONError(w, re.status, re.msg)
		return
	}
	writeJSONError(w, http.StatusBadRequest, "invalid request")
}

// handleTree explores the ADE hierarchy for an institution or direct token link.
func (s *Server) handleTree(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost && !s.treeLimiter.Allow(s.clientIP(r)) {
		writeJSONError(w, http.StatusTooManyRequests, "too many requests, please try again later")
		return
	}

	var req treeRequest
	if !decodeJSONRequest(w, r, &req) {
		return
	}

	req.UniversityID = strings.TrimSpace(req.UniversityID)
	req.ADEURL = strings.TrimSpace(req.ADEURL)
	req.BranchID = strings.TrimSpace(req.BranchID)
	req.Category = strings.TrimSpace(req.Category)
	req.Login = strings.TrimSpace(req.Login)

	if !categoryRegex.MatchString(req.Category) {
		writeJSONError(w, http.StatusBadRequest, "invalid category")
		return
	}
	if req.BranchID != "" && !nodeIDRegex.MatchString(req.BranchID) {
		writeJSONError(w, http.StatusBadRequest, "invalid branchId")
		return
	}
	path, err := validateBranchPath(req.BranchPath)
	if err != nil {
		writeRequestError(w, err)
		return
	}
	if len(path) == 0 && req.BranchID != "" {
		path = []string{req.BranchID}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	target, err := s.resolveTarget(ctx, req.UniversityID, req.ADEURL, req.Login, req.Password)
	if err != nil {
		writeRequestError(w, err)
		return
	}

	nodes, err := s.newUpstreamClient(target, req.Login, req.Password).FetchTreeNodes(ctx, req.Category, path)
	if err != nil {
		s.logger.Debug("tree fetch failed", "baseURL", target.baseURL, "institutionPath", target.institutionPath, "error", err)
		s.writeUpstreamError(w, err, false)
		return
	}

	if nodes == nil {
		nodes = []ade.TreeNode{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"nodes": nodes})
}

// handleUniversitiesList returns the public list of universities ICSExplorer
// can fetch a personal calendar from. No credentials are exposed here.
func (s *Server) handleUniversitiesList(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	list, err := s.universityDirectory.List(ctx)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "could not discover the list of universities")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

// isEsisarTarget reports whether t is the Grenoble INP / Esisar instance,
// whose event naming conventions FormatCalendarLines knows how to prettify.
func isEsisarTarget(t adeTarget) bool {
	return strings.TrimRight(t.baseURL, "/") == ade.EsisarBaseURL && t.institutionPath == ade.EsisarInstitutionPath
}

// handlePersonalCalendar logs into the requested university's ADE Campus instance
// with user-supplied credentials and returns that student's personal calendar as ICS.
//
// This endpoint is fully stateless: the login/password are used in-memory for a
// single upstream request to the target ADE server and are never written to disk,
// cache, or logs. Whether the frontend remembers these credentials for next time is
// entirely a client-side decision (see frontend/src/composables/useAdeTree.js).
func (s *Server) handlePersonalCalendar(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost && !s.calendarLimiter.Allow(s.clientIP(r)) {
		writeJSONError(w, http.StatusTooManyRequests, "too many requests, please try again later")
		return
	}

	var req personalCalendarRequest
	if !decodeJSONRequest(w, r, &req) {
		return
	}

	req.UniversityID = strings.TrimSpace(req.UniversityID)
	req.ADEURL = strings.TrimSpace(req.ADEURL)
	req.ResourceID = strings.TrimSpace(req.ResourceID)
	req.Login = strings.TrimSpace(req.Login)

	if !ade.ValidResourceIDs(req.ResourceID) {
		writeJSONError(w, http.StatusBadRequest, "invalid resourceId")
		return
	}
	branchPath, err := validateBranchPath(req.BranchPath)
	if err != nil {
		writeRequestError(w, err)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	target, err := s.resolveTarget(ctx, req.UniversityID, req.ADEURL, req.Login, req.Password)
	if err != nil {
		writeRequestError(w, err)
		return
	}

	// An explicit resourceId in the request takes precedence over one found in a pasted URL.
	resourceID := target.resourceID
	if req.ResourceID != "" {
		resourceID = req.ResourceID
	}

	client := s.newUpstreamClient(target, req.Login, req.Password)

	var raw []byte
	if dataToken, ok := strings.CutPrefix(target.institutionPath, "direct?data="); ok {
		raw, err = client.FetchDirectTokenCalendar(ctx, dataToken, resourceID, branchPath)
	} else {
		raw, err = client.FetchCalendarRaw(ctx, resourceID)
	}
	if err != nil {
		s.logger.Debug("personal calendar fetch failed", "baseURL", target.baseURL, "institutionPath", target.institutionPath, "academicYear", target.academicYear, "resourceID", resourceID, "error", err)
		s.writeUpstreamError(w, err, resourceID == "")
		return
	}

	// Only the Esisar instance gets its naming conventions rewritten; other
	// institutions keep their original event text (dates are still sanitized).
	unfolded := ics.UnfoldLines(raw)
	var formatted []string
	if isEsisarTarget(target) {
		formatted = ics.FormatCalendarLines(unfolded)
	} else {
		formatted = ics.SanitizeCalendarLines(unfolded)
	}

	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(ics.JoinLines(formatted)))
}
