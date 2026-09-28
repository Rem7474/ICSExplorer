package ade

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestValidResourceIDs(t *testing.T) {
	valid := []string{"", "42", "42,43,1001", "leaf456", "a_b-c"}
	for _, ids := range valid {
		if !ValidResourceIDs(ids) {
			t.Errorf("expected %q to be valid", ids)
		}
	}
	invalid := []string{"42&projectId=1", "42,", ",42", "4 2", "42#x", "../x", strings.Repeat("1,", 4000) + "1"}
	for _, ids := range invalid {
		if ValidResourceIDs(ids) {
			t.Errorf("expected %q to be rejected", ids)
		}
	}
}

func TestReadLimited(t *testing.T) {
	if _, err := readLimited(strings.NewReader("12345"), 5); err != nil {
		t.Errorf("body at the limit should be accepted: %v", err)
	}
	if _, err := readLimited(strings.NewReader("123456"), 5); err == nil {
		t.Error("body over the limit should be rejected")
	}
}

func TestFetchCalendarRawRejectsOversizedBody(t *testing.T) {
	big := strings.Repeat("X", maxCalendarBytes+1)
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/directCal") {
			_, _ = w.Write([]byte(big))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mock.Close()

	client := NewClientForInstitution("", "", "2026-2027", mock.URL, "etudiant/test")
	if _, err := client.FetchCalendarRaw(context.Background(), "42"); err == nil {
		t.Fatal("expected an oversized calendar to be rejected")
	}
}

// TestCollectLeavesUnderPathIsBounded builds an infinitely wide/deep fake tree
// and checks the walk stops at the request budget instead of fanning out.
func TestCollectLeavesUnderPathIsBounded(t *testing.T) {
	var requests atomic.Int32
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		id := r.URL.Query().Get("branchId")
		if id == "" {
			return
		}
		// Every branch has 10 sub-branches.
		for i := 0; i < 10; i++ {
			fmt.Fprintf(w, `<DIV class="treeline"><a href="javascript:openBranch(%s%d)"><img></a><SPAN class="treebranch"><a href="#">B%d</a></SPAN></DIV>`, id, i, i)
		}
	}))
	defer mock.Close()

	client := NewClientForInstitution("", "", "", mock.URL, "direct?data=tok")
	_, err := client.CollectLeavesUnderPath(context.Background(), "tok", "trainee", []string{"1"})
	if err == nil {
		t.Fatal("expected the walk to abort once the request budget is exhausted")
	}
	if n := requests.Load(); n > maxTreeRequests {
		t.Errorf("expected at most %d upstream requests, got %d", maxTreeRequests, n)
	}
}
