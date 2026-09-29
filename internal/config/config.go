package config

import (
	"fmt"
	"net/netip"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration options for the server and scraper.
type Config struct {
	Port             int
	AgalanLogin      string
	AgalanPassword   string
	DataDir          string
	OutputDir        string
	RoomsOutputDir   string
	StaticDir        string
	SyncInterval     time.Duration
	SyncOnStartup    bool
	SyncCercle       bool
	CercleIcsURL     string
	SyncRU           bool
	RURestaurantID   string
	RUSlotStartHour  int
	RUSlotStartMin   int
	RUSlotEndHour    int
	RUSlotEndMin     int
	Concurrency      int
	MaxDataAge       time.Duration
	MinFileSizeBytes int64
	AcademicYear     string
	LogLevel         string
	LogFormat        string
	AdminToken       string
	// TrustedProxies lists the reverse proxies whose X-Forwarded-For and
	// X-Forwarded-Proto headers are honored (e.g. "127.0.0.1,172.16.0.0/12").
	TrustedProxies []netip.Prefix
}

// DefaultCercleURL is the official public Google Calendar of Cercle Esisar.
const DefaultCercleURL = "https://calendar.google.com/calendar/ical/c_4f3a9a83f7553fcc57df17517ec30d8b2e24fd86f06499412472bdd346b88f38@group.calendar.google.com/public/basic.ics"

// DetectAcademicYear returns the current academic year in format "YYYY-YYYY+1".
// Academic year starts in August (month >= 8).
func DetectAcademicYear(now time.Time) string {
	year := now.Year()
	if now.Month() < time.August {
		year--
	}
	return fmt.Sprintf("%d-%d", year, year+1)
}

// Load loads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	now := time.Now()
	academicYear := getEnv("ACADEMIC_YEAR", DetectAcademicYear(now))

	port, err := strconv.Atoi(getEnv("PORT", "8080"))
	if err != nil || port <= 0 || port > 65535 {
		port = 8080
	}

	dataDir := getEnv("DATA_DIR", "data")
	outputDir := getEnv("OUTPUT_DIR", filepath.Join(dataDir, "output"))
	roomsOutputDir := getEnv("ROOMS_OUTPUT_DIR", filepath.Join(dataDir, "rooms"))
	staticDir := getEnv("STATIC_DIR", "frontend/dist")

	syncIntervalStr := getEnv("SYNC_INTERVAL", "30m")
	syncInterval, err := time.ParseDuration(syncIntervalStr)
	if err != nil || syncInterval <= 0 {
		syncInterval = 30 * time.Minute
	}

	maxDataAgeStr := getEnv("MAX_DATA_AGE", "24h")
	maxDataAge, err := time.ParseDuration(maxDataAgeStr)
	if err != nil || maxDataAge <= 0 {
		maxDataAge = 24 * time.Hour
	}

	concurrency, err := strconv.Atoi(getEnv("CONCURRENCY", "5"))
	if err != nil || concurrency <= 0 {
		concurrency = 5
	}

	minFileSize, err := strconv.ParseInt(getEnv("MIN_FILE_SIZE_BYTES", "50000"), 10, 64)
	if err != nil || minFileSize <= 0 {
		minFileSize = 50000
	}

	trustedProxies, err := parseTrustedProxies(getEnv("TRUSTED_PROXIES", ""))
	if err != nil {
		return nil, err
	}

	startH, startM := parseTimeSlot(getEnv("RU_SLOT_START", "12:00"), 12, 0)
	endH, endM := parseTimeSlot(getEnv("RU_SLOT_END", "13:00"), 13, 0)

	cfg := &Config{
		Port:             port,
		AgalanLogin:      getEnv("AGALAN_LOGIN", ""),
		AgalanPassword:   getEnv("AGALAN_PASSWORD", ""),
		DataDir:          dataDir,
		OutputDir:        outputDir,
		RoomsOutputDir:   roomsOutputDir,
		StaticDir:        staticDir,
		SyncInterval:     syncInterval,
		SyncOnStartup:    getEnvBool("SYNC_ON_STARTUP", true),
		SyncCercle:       getEnvBool("SYNC_CERCLE", true),
		CercleIcsURL:     getEnv("CERCLE_ICS_URL", DefaultCercleURL),
		SyncRU:           getEnvBool("SYNC_RU", true),
		RURestaurantID:   getEnv("RU_RESTAURANT_ID", "1459"),
		RUSlotStartHour:  startH,
		RUSlotStartMin:   startM,
		RUSlotEndHour:    endH,
		RUSlotEndMin:     endM,
		Concurrency:      concurrency,
		MaxDataAge:       maxDataAge,
		MinFileSizeBytes: minFileSize,
		AcademicYear:     academicYear,
		LogLevel:         strings.ToLower(getEnv("LOG_LEVEL", "info")),
		LogFormat:        strings.ToLower(getEnv("LOG_FORMAT", "text")),
		AdminToken:       getEnv("ADMIN_TOKEN", ""),
		TrustedProxies:   trustedProxies,
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := strings.TrimSpace(os.Getenv(key)); val != "" {
		return val
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if val := strings.TrimSpace(os.Getenv(key)); val != "" {
		valLower := strings.ToLower(val)
		return valLower == "true" || valLower == "1" || valLower == "yes" || valLower == "on"
	}
	return fallback
}

func parseTimeSlot(slotStr string, fallbackHour, fallbackMin int) (hour, minute int) {
	parts := strings.Split(strings.TrimSpace(slotStr), ":")
	if len(parts) == 2 {
		h, err1 := strconv.Atoi(parts[0])
		m, err2 := strconv.Atoi(parts[1])
		if err1 == nil && err2 == nil && h >= 0 && h <= 23 && m >= 0 && m <= 59 {
			return h, m
		}
	}
	return fallbackHour, fallbackMin
}

// parseTrustedProxies parses a comma-separated list of IP addresses and/or
// CIDR prefixes. An invalid entry is a configuration error rather than being
// silently ignored, since it would change which client IP gets rate-limited.
func parseTrustedProxies(raw string) ([]netip.Prefix, error) {
	var prefixes []netip.Prefix
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			p, err := netip.ParsePrefix(entry)
			if err != nil {
				return nil, fmt.Errorf("invalid TRUSTED_PROXIES entry %q: %w", entry, err)
			}
			prefixes = append(prefixes, p.Masked())
			continue
		}
		addr, err := netip.ParseAddr(entry)
		if err != nil {
			return nil, fmt.Errorf("invalid TRUSTED_PROXIES entry %q: %w", entry, err)
		}
		addr = addr.Unmap()
		prefixes = append(prefixes, netip.PrefixFrom(addr, addr.BitLen()))
	}
	return prefixes, nil
}
