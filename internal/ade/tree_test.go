package ade

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestParseTreeHTML(t *testing.T) {
	html := `
	<DIV class="treeline">
		<a href="javascript:openBranch(1674)"><img src="/jsp/img/plus.gif"></a>
		<SPAN CLASS="treecross"><a href="javascript:checkBranch(1674, 'false')"></a></SPAN>
		<SPAN class="treebranch"><a href="javascript:checkBranch(1674, 'true')">CAMPUS Grenoble</a></SPAN>
	</DIV>
	<DIV class="treeline">
		<a href="javascript:openBranch('353')"><img src="/jsp/img/plus.gif"></a>
		<SPAN class="treebranch"><a href="javascript:checkBranch('353')">CAMPUS Valence</a></SPAN>
	</DIV>
	<DIV class="treeline">
		<SPAN CLASS="treeleaf"><a href="javascript:check(1234, 'false')">1A - Groupe 1</a></SPAN>
	</DIV>
	<DIV class="treeline">
		<SPAN CLASS="treeleaf"><a href="javascript:check('5678')">1A - Groupe 2</a></SPAN>
	</DIV>
	`

	nodes := ParseTreeHTML(html)
	if len(nodes) != 4 {
		t.Fatalf("expected 4 nodes, got %d: %+v", len(nodes), nodes)
	}

	if nodes[0].ID != "1674" || nodes[0].Name != "CAMPUS Grenoble" || nodes[0].IsLeaf {
		t.Errorf("unexpected node 0: %+v", nodes[0])
	}
	if nodes[1].ID != "353" || nodes[1].Name != "CAMPUS Valence" || nodes[1].IsLeaf {
		t.Errorf("unexpected node 1: %+v", nodes[1])
	}
	if nodes[2].ID != "1234" || nodes[2].Name != "1A - Groupe 1" || !nodes[2].IsLeaf {
		t.Errorf("unexpected node 2: %+v", nodes[2])
	}
	if nodes[3].ID != "5678" || nodes[3].Name != "1A - Groupe 2" || !nodes[3].IsLeaf {
		t.Errorf("unexpected node 3: %+v", nodes[3])
	}
}

func TestClientFetchTreeNodes(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/2026-2027/etudiant/esisar" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path == "/2026-2027/etudiant/esisar/jsp/standard/gui/tree.jsp" {
			w.WriteHeader(http.StatusOK)
			fmt.Fprint(w, `
				<DIV class="treeline">
					<a href="javascript:openBranch(10)"><img src="plus.gif"></a>
					<SPAN class="treebranch"><a href="#">Filiere Info</a></SPAN>
				</DIV>
				<DIV class="treeline">
					<SPAN class="treeleaf"><a href="javascript:check(101)">Groupe A</a></SPAN>
				</DIV>
			`)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	client := NewClientForInstitution("student", "secret", "2026-2027", mockServer.URL, "etudiant/esisar")
	nodes, err := client.FetchTreeNodes(context.Background(), "trainee", nil)
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if len(nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(nodes))
	}
	if nodes[0].Name != "Filiere Info" || nodes[0].IsLeaf {
		t.Errorf("unexpected node 0: %+v", nodes[0])
	}
	if nodes[1].Name != "Groupe A" || !nodes[1].IsLeaf {
		t.Errorf("unexpected node 1: %+v", nodes[1])
	}
}
