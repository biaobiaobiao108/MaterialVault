package utils

import (
	"net/url"
	"regexp"
	"strings"
)

// extractHashtags extracts unique hashtag names from text (e.g., "#AI #格斗" -> ["AI", "格斗"])
var hashtagRegex = regexp.MustCompile(`(?:^|\s)#([\p{L}\p{N}_-]+)`)

func ExtractHashtags(text string) []string {
	if text == "" {
		return nil
	}
	matches := hashtagRegex.FindAllStringSubmatch(text, -1)
	if len(matches) == 0 {
		return nil
	}

	seen := make(map[string]bool)
	var tags []string
	for _, m := range matches {
		if len(m) > 1 {
			cleaned := strings.TrimSpace(m[1])
			if cleaned != "" && !seen[cleaned] {
				seen[cleaned] = true
				tags = append(tags, cleaned)
			}
		}
	}
	return tags
}

func NormalizeURL(rawURL string) (normalized string, domain string, err error) {
	clean := strings.TrimSpace(rawURL)
	if !strings.HasPrefix(strings.ToLower(clean), "http://") && !strings.HasPrefix(strings.ToLower(clean), "https://") {
		clean = "https://" + clean
	}

	parsed, err := url.Parse(clean)
	if err != nil {
		return rawURL, "", err
	}

	// Remove tracking query params like utm_*
	q := parsed.Query()
	trackingParams := []string{"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm_id_from", "from_source"}
	for _, p := range trackingParams {
		q.Del(p)
	}
	parsed.RawQuery = q.Encode()

	domain = parsed.Hostname()
	domain = strings.TrimPrefix(domain, "www.")

	return parsed.String(), domain, nil
}
