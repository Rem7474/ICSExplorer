package ade

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var academicYearSegmentRegex = regexp.MustCompile(`^\d{4}-\d{4}$`)

// ParseInstanceURL extracts the pieces needed to target an ADE Campus
// instance (base URL, academic year, institution path, and an optional
// resource ID) from a URL a user copy-pasted from their institution's ADE
// portal. This lets a user configure a school ICSExplorer doesn't already
// know about, by pasting any ADE URL they can reach - an export link, a
// portal link, or the browser planning page URL - rather than requiring one
// manually registered entry per school.
//
// Two path layouts are recognized, both observed on Grenoble INP's ADE
// deployment and typical of ADE Campus in general:
//   - {year}/etudiant/{school}[...]              (portal links, directCal exports)
//   - {year}/{school}/etudiant/...                (the browser planning UI)
//
// A "resources" query parameter, if present, is returned as resourceID: ADE
// Campus's directCal export does not resolve an authenticated user's own
// calendar automatically, so a resource ID (found once via the ADE web UI)
// is generally required.
func ParseInstanceURL(raw string) (baseURL, academicYear, institutionPath, resourceID string, err error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", "", "", "", fmt.Errorf("invalid URL")
	}
	baseURL = u.Scheme + "://" + u.Host
	resourceID = u.Query().Get("resources")

	segments := strings.Split(strings.Trim(u.Path, "/"), "/")

	for _, seg := range segments {
		if academicYearSegmentRegex.MatchString(seg) {
			academicYear = seg
			break
		}
	}
	if academicYear == "" {
		return "", "", "", "", fmt.Errorf("could not find an academic year (YYYY-YYYY) in the URL")
	}

	etudiantIdx := -1
	for i, seg := range segments {
		if seg == "etudiant" {
			etudiantIdx = i
			break
		}
	}
	if etudiantIdx == -1 {
		return "", "", "", "", fmt.Errorf("could not find the 'etudiant' segment in the URL")
	}

	// If the segment right before "etudiant" is the academic year, the school
	// follows it (portal/export style: {year}/etudiant/{school}). Otherwise the
	// school precedes "etudiant" (browser UI style: {year}/{school}/etudiant/...).
	if etudiantIdx > 0 && academicYearSegmentRegex.MatchString(segments[etudiantIdx-1]) {
		if etudiantIdx+1 >= len(segments) || segments[etudiantIdx+1] == "" {
			return "", "", "", "", fmt.Errorf("could not find the school segment after 'etudiant'")
		}
		return baseURL, academicYear, "etudiant/" + segments[etudiantIdx+1], resourceID, nil
	}

	if etudiantIdx == 0 {
		return "", "", "", "", fmt.Errorf("could not find the school segment before 'etudiant'")
	}
	return baseURL, academicYear, "etudiant/" + segments[etudiantIdx-1], resourceID, nil
}
