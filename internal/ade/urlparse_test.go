package ade

import "testing"

func TestParseInstanceURL(t *testing.T) {
	cases := []struct {
		name                                                       string
		in                                                         string
		wantBaseURL, wantYear, wantInstitutionPath, wantResourceID string
		wantErr                                                    bool
	}{
		{
			name:                "portal link style",
			in:                  "https://edt.grenoble-inp.fr/2025-2026/etudiant/esisar",
			wantBaseURL:         "https://edt.grenoble-inp.fr",
			wantYear:            "2025-2026",
			wantInstitutionPath: "etudiant/esisar",
		},
		{
			name:                "directCal export style with resource ID in query string",
			in:                  "https://edt.grenoble-inp.fr/directCal/2026-2027/etudiant/esisar?resources=1234&startDay=31",
			wantBaseURL:         "https://edt.grenoble-inp.fr",
			wantYear:            "2026-2027",
			wantInstitutionPath: "etudiant/esisar",
			wantResourceID:      "1234",
		},
		{
			name:                "browser planning UI style (school before etudiant)",
			in:                  "https://edt.grenoble-inp.fr/2026-2027/esisar/etudiant/jsp/custom/modules/plannings/direct_planning.jsp",
			wantBaseURL:         "https://edt.grenoble-inp.fr",
			wantYear:            "2026-2027",
			wantInstitutionPath: "etudiant/esisar",
		},
		{
			name:                "different school and year",
			in:                  "https://edt.grenoble-inp.fr/2024-2025/ense3/etudiant/jsp/standard/gui/tree.jsp",
			wantBaseURL:         "https://edt.grenoble-inp.fr",
			wantYear:            "2024-2025",
			wantInstitutionPath: "etudiant/ense3",
		},
		{
			name:                "direct token data URL style",
			in:                  "https://ade-uga-ro-vs.grenet.fr/direct/index.jsp?data=51278da58f6a&resources=999",
			wantBaseURL:         "https://ade-uga-ro-vs.grenet.fr",
			wantInstitutionPath: "direct?data=51278da58f6a",
			wantResourceID:      "999",
		},
		{
			name:    "missing academic year",
			in:      "https://edt.grenoble-inp.fr/etudiant/esisar",
			wantErr: true,
		},
		{
			name:    "missing etudiant segment",
			in:      "https://edt.grenoble-inp.fr/2025-2026/enseignant/aip",
			wantErr: true,
		},
		{
			name:    "not a URL",
			in:      "not a url",
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			baseURL, year, institutionPath, resourceID, err := ParseInstanceURL(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected an error, got baseURL=%q year=%q institutionPath=%q resourceID=%q", baseURL, year, institutionPath, resourceID)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if baseURL != tc.wantBaseURL {
				t.Errorf("baseURL = %q, want %q", baseURL, tc.wantBaseURL)
			}
			if year != tc.wantYear {
				t.Errorf("year = %q, want %q", year, tc.wantYear)
			}
			if institutionPath != tc.wantInstitutionPath {
				t.Errorf("institutionPath = %q, want %q", institutionPath, tc.wantInstitutionPath)
			}
			if resourceID != tc.wantResourceID {
				t.Errorf("resourceID = %q, want %q", resourceID, tc.wantResourceID)
			}
		})
	}
}
