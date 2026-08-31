package server

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/ade"
	"github.com/Rem7474/ICSExplorer/internal/ics"
)

// maxPersonalCalendarBodyBytes bounds the request body size for /api/personal-calendar.
const maxPersonalCalendarBodyBytes = 4096

type personalCalendarRequest struct {
	UniversityID string `json:"universityId"`
	ADEURL       string `json:"adeUrl"`
	ResourceID   string `json:"resourceId"`
	Login        string `json:"login"`
	Password     string `json:"password"`
}

// handleUniversitiesList returns the public list of universities ICSExplorer
// can fetch a personal calendar from. No credentials are exposed here.
func (s *Server) handleUniversitiesList(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	list, err := s.universityDirectory.List(ctx)
	if err != nil {
		http.Error(w, `{"error":"could not discover the list of universities"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(list)
}

// handlePersonalCalendar logs into the requested university's ADE Campus instance
// with user-supplied credentials and returns that student's personal calendar as ICS.
//
// This endpoint is fully stateless: the login/password are used in-memory for a
// single upstream request to the target ADE server and are never written to disk,
// cache, or logs. Whether the frontend remembers these credentials for next time is
// entirely a client-side decision (see frontend/src/components/PersonalScheduleModal.vue).
func (s *Server) handlePersonalCalendar(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	if !s.personalCalendarLimiter.Allow(clientIP(r)) {
		http.Error(w, `{"error":"too many requests, please try again later"}`, http.StatusTooManyRequests)
		return
	}

	var req personalCalendarRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, maxPersonalCalendarBodyBytes)).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
		return
	}

	req.UniversityID = strings.TrimSpace(req.UniversityID)
	req.ADEURL = strings.TrimSpace(req.ADEURL)
	req.ResourceID = strings.TrimSpace(req.ResourceID)
	req.Login = strings.TrimSpace(req.Login)

	if req.UniversityID == "" && req.ADEURL == "" {
		http.Error(w, `{"error":"either universityId or adeUrl is required"}`, http.StatusBadRequest)
		return
	}
	// Universities from the registry are only known to use Basic Auth (see
	// internal/ade/client.go), so a login/password is mandatory for that path.
	// A pasted adeUrl may already embed its own access token (some ADE Campus
	// deployments hand out self-authenticating "direct access" links), in which
	// case no separate credentials are needed - the request is then sent
	// without an Authorization header.
	if req.UniversityID != "" && (req.Login == "" || req.Password == "") {
		http.Error(w, `{"error":"login and password are required for this university"}`, http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	var baseURL, academicYear, institutionPath, resourceID string

	if req.ADEURL != "" {
		// The user pasted a URL from their own ADE portal: parse it rather than
		// requiring their school to be pre-registered.
		var err error
		baseURL, academicYear, institutionPath, resourceID, err = ade.ParseInstanceURL(req.ADEURL)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "could not recognize this as an ADE URL: " + err.Error(),
			})
			return
		}
	} else {
		uni, ok := s.universityDirectory.Find(ctx, req.UniversityID)
		if !ok {
			http.Error(w, `{"error":"unknown university"}`, http.StatusBadRequest)
			return
		}
		baseURL, academicYear, institutionPath = uni.BaseURL, s.cfg.AcademicYear, uni.InstitutionPath
	}

	// An explicit resourceId in the request takes precedence over one found in a pasted URL.
	if req.ResourceID != "" {
		resourceID = req.ResourceID
	}

	client := ade.NewClientForInstitution(req.Login, req.Password, academicYear, baseURL, institutionPath)

	var raw []byte
	var err error
	if strings.HasPrefix(institutionPath, "direct?data=") {
		dataToken := strings.TrimPrefix(institutionPath, "direct?data=")
		raw, err = client.FetchDirectTokenCalendar(ctx, dataToken)
	} else {
		raw, err = client.FetchCalendarRaw(ctx, resourceID)
	}
	if err != nil {
		s.logger.Debug("personal calendar fetch failed", "baseURL", baseURL, "institutionPath", institutionPath, "academicYear", academicYear, "resourceID", resourceID, "error", err)
		if strings.Contains(err.Error(), "401") {
			http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
			return
		}
		if resourceID == "" && strings.Contains(err.Error(), "500") {
			http.Error(w, `{"error":"this ADE server requires a resource ID to identify your calendar - find yours via the ADE web planning view and provide it (or paste a URL that already includes '?resources=...')"}`, http.StatusBadRequest)
			return
		}
		http.Error(w, `{"error":"could not reach the university's ADE server"}`, http.StatusBadGateway)
		return
	}

	unfolded := ics.UnfoldLines(raw)
	formatted := ics.FormatCalendarLines(unfolded)

	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(ics.JoinLines(formatted)))
}
