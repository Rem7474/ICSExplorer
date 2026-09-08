// Package university discovers and caches the list of schools ICSExplorer can
// fetch a personal calendar for, by scraping the public root portal page of
// each known ADE Campus deployment.
package university

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Rem7474/ICSExplorer/internal/ade"
)

// University describes one school ("composante") discovered on an ADE Campus
// deployment. It carries no secrets: the login/password used to authenticate
// against it are supplied per-request by the end user, never stored here.
type University struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	BaseURL         string `json:"-"`
	InstitutionPath string `json:"-"`
}

// Deployment is one ADE Campus server that may host several schools.
// RootURL is its public portal page listing every school ("etudiant/{id}"
// links); BaseURL is the server used for authenticated calendar exports.
type Deployment struct {
	// Slug prefixes discovered university IDs so they can't collide across deployments.
	Slug    string
	RootURL string
	BaseURL string
}

// DefaultDeployments lists the ADE Campus servers ICSExplorer knows about.
// Each one is auto-discovered: every school it hosts is found by scraping its
// public root portal page, so supporting a new school already hosted on a
// known server (e.g. another Grenoble INP composante) requires no code change.
func DefaultDeployments() []Deployment {
	return []Deployment{
		{Slug: "grenoble-inp", RootURL: "https://edt.grenoble-inp.fr/", BaseURL: "https://edt.grenoble-inp.fr"},
	}
}

// Directory discovers and caches the universities available across a set of
// ADE Campus deployments, refreshing at most once per ttl.
type Directory struct {
	deployments []Deployment
	ttl         time.Duration

	mu          sync.RWMutex
	cache       []University
	lastRefresh time.Time
}

// NewDirectory creates a Directory over the given deployments.
func NewDirectory(deployments []Deployment, ttl time.Duration) *Directory {
	return &Directory{deployments: deployments, ttl: ttl}
}

// List returns the known universities, discovering (or reusing a cached
// discovery) as needed.
func (d *Directory) List(ctx context.Context) ([]University, error) {
	d.mu.RLock()
	fresh := len(d.cache) > 0 && time.Since(d.lastRefresh) < d.ttl
	cached := d.cache
	d.mu.RUnlock()

	if fresh {
		return cached, nil
	}
	return d.refresh(ctx)
}

// Find looks up a university by ID, refreshing the directory if needed.
func (d *Directory) Find(ctx context.Context, id string) (University, bool) {
	list, err := d.List(ctx)
	if err != nil {
		return University{}, false
	}
	for _, u := range list {
		if u.ID == id {
			return u, true
		}
	}
	return University{}, false
}

// refresh re-discovers universities from every deployment. If discovery fails
// entirely but a previous successful discovery is cached, it serves that
// stale list rather than erroring out.
func (d *Directory) refresh(ctx context.Context) ([]University, error) {
	var all []University
	var lastErr error

	for _, dep := range d.deployments {
		institutions, err := ade.DiscoverInstitutions(ctx, dep.RootURL)
		if err != nil {
			lastErr = err
			continue
		}
		for _, inst := range institutions {
			all = append(all, University{
				ID:              dep.Slug + "-" + inst.ID,
				Name:            inst.Name,
				BaseURL:         dep.BaseURL,
				InstitutionPath: "etudiant/" + inst.ID,
			})
		}
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	if len(all) > 0 {
		d.cache = all
		d.lastRefresh = time.Now()
		return all, nil
	}
	if len(d.cache) > 0 {
		return d.cache, nil
	}
	if lastErr != nil {
		return nil, fmt.Errorf("failed to discover universities: %w", lastErr)
	}
	return nil, fmt.Errorf("no universities discovered")
}
