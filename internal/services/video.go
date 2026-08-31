package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type VideoInfo struct {
	Platform string // "bilibili" | "youtube"
	VideoID  string // BV id, AV id, or YouTube Video ID
	CleanURL string
}

type VideoResult struct {
	Platform      string
	VideoID       string
	Title         string
	Description   string
	Author        string
	CoverURL      string
	CoverData     []byte
	CoverMime     string
	CoverFileName string
	Duration      int
}

var (
	ytWatchRegex   = regexp.MustCompile(`(?:v=|/embed/|/shorts/|youtu\.be/)([a-zA-Z0-9_-]{11})`)
	biliBVRegex    = regexp.MustCompile(`(BV[0-9a-zA-Z]{10})`)
	biliAVRegex    = regexp.MustCompile(`av([0-9]+)`)
	biliTitleClean = regexp.MustCompile(`_哔哩哔哩_bilibili.*$| - 哔哩哔哩.*$|_\(゜-゜\)つロ 干杯~-bilibili.*$`)
)

// DetectVideoInfo checks if a URL belongs to Bilibili or YouTube
func DetectVideoInfo(targetURL string) *VideoInfo {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return nil
	}

	host := strings.ToLower(parsed.Hostname())
	host = strings.TrimPrefix(host, "www.")

	// 1. YouTube detection
	if host == "youtube.com" || host == "m.youtube.com" || host == "youtu.be" {
		matches := ytWatchRegex.FindStringSubmatch(targetURL)
		if len(matches) > 1 {
			videoID := matches[1]
			return &VideoInfo{
				Platform: "youtube",
				VideoID:  videoID,
				CleanURL: fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID),
			}
		}
	}

	// 2. Bilibili detection (bilibili.com, m.bilibili.com, b23.tv)
	if host == "bilibili.com" || host == "m.bilibili.com" {
		if m := biliBVRegex.FindStringSubmatch(targetURL); len(m) > 1 {
			return &VideoInfo{
				Platform: "bilibili",
				VideoID:  m[1],
				CleanURL: fmt.Sprintf("https://www.bilibili.com/video/%s", m[1]),
			}
		}
		if m := biliAVRegex.FindStringSubmatch(targetURL); len(m) > 1 {
			return &VideoInfo{
				Platform: "bilibili",
				VideoID:  "av" + m[1],
				CleanURL: fmt.Sprintf("https://www.bilibili.com/video/av%s", m[1]),
			}
		}
	}

	if host == "b23.tv" {
		// b23.tv may contain BV directly or require redirect
		if m := biliBVRegex.FindStringSubmatch(targetURL); len(m) > 1 {
			return &VideoInfo{
				Platform: "bilibili",
				VideoID:  m[1],
				CleanURL: fmt.Sprintf("https://www.bilibili.com/video/%s", m[1]),
			}
		}
		// Resolve b23.tv redirect
		redirectURL := resolveB23Redirect(targetURL)
		if redirectURL != "" {
			if m := biliBVRegex.FindStringSubmatch(redirectURL); len(m) > 1 {
				return &VideoInfo{
					Platform: "bilibili",
					VideoID:  m[1],
					CleanURL: fmt.Sprintf("https://www.bilibili.com/video/%s", m[1]),
				}
			}
		}
	}

	return nil
}

func resolveB23Redirect(shortURL string) string {
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // don't follow, just get location
		},
	}
	resp, err := client.Get(shortURL)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	return resp.Header.Get("Location")
}

// FetchVideoMetaAndCover retrieves video title, author, description, and downloaded cover
func FetchVideoMetaAndCover(ctx context.Context, info *VideoInfo) (*VideoResult, error) {
	if info.Platform == "bilibili" {
		return fetchBilibiliVideo(ctx, info)
	} else if info.Platform == "youtube" {
		return fetchYouTubeVideo(ctx, info)
	}
	return nil, fmt.Errorf("unsupported video platform: %s", info.Platform)
}

type biliAPIResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		BVID     string `json:"bvid"`
		AID      int64  `json:"aid"`
		Title    string `json:"title"`
		Pic      string `json:"pic"`
		Desc     string `json:"desc"`
		Duration int    `json:"duration"`
		Owner    struct {
			Name string `json:"name"`
		} `json:"owner"`
	} `json:"data"`
}

func fetchBilibiliVideo(ctx context.Context, info *VideoInfo) (*VideoResult, error) {
	var apiURL string
	if strings.HasPrefix(info.VideoID, "BV") {
		apiURL = fmt.Sprintf("https://api.bilibili.com/x/web-interface/view?bvid=%s", info.VideoID)
	} else {
		aid := strings.TrimPrefix(info.VideoID, "av")
		apiURL = fmt.Sprintf("https://api.bilibili.com/x/web-interface/view?aid=%s", aid)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bilibili api error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bilibili api status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var apiResp biliAPIResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("bilibili parse json error: %w", err)
	}

	if apiResp.Code != 0 {
		return nil, fmt.Errorf("bilibili api code %d: %s", apiResp.Code, apiResp.Message)
	}

	title := strings.TrimSpace(apiResp.Data.Title)
	title = biliTitleClean.ReplaceAllString(title, "")

	// Normalize Bilibili cover URL (prepend https: if scheme is missing)
	picURL := apiResp.Data.Pic
	if strings.HasPrefix(picURL, "//") {
		picURL = "https:" + picURL
	} else if strings.HasPrefix(picURL, "http://") {
		picURL = "https://" + strings.TrimPrefix(picURL, "http://")
	}

	res := &VideoResult{
		Platform:    "bilibili",
		VideoID:     info.VideoID,
		Title:       title,
		Description: strings.TrimSpace(apiResp.Data.Desc),
		Author:      strings.TrimSpace(apiResp.Data.Owner.Name),
		CoverURL:    picURL,
		Duration:    apiResp.Data.Duration,
	}

	// Download original creator-uploaded cover image with Referer header
	if res.CoverURL != "" {
		coverData, mime, err := downloadImage(ctx, res.CoverURL, "https://www.bilibili.com/")
		if err == nil {
			res.CoverData = coverData
			res.CoverMime = mime
			res.CoverFileName = "cover.jpg"
		}
	}

	return res, nil
}

type ytOEmbedResponse struct {
	Title        string `json:"title"`
	AuthorName   string `json:"author_name"`
	ThumbnailURL string `json:"thumbnail_url"`
}

func fetchYouTubeVideo(ctx context.Context, info *VideoInfo) (*VideoResult, error) {
	res := &VideoResult{
		Platform: "youtube",
		VideoID:  info.VideoID,
	}

	// 1. Fetch metadata from oEmbed API
	oEmbedURL := fmt.Sprintf("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=%s&format=json", info.VideoID)
	req, err := http.NewRequestWithContext(ctx, "GET", oEmbedURL, nil)
	if err == nil {
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
		client := &http.Client{Timeout: 8 * time.Second}
		if resp, err := client.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var oembed ytOEmbedResponse
				if err := json.NewDecoder(resp.Body).Decode(&oembed); err == nil {
					res.Title = strings.TrimSpace(oembed.Title)
					res.Author = strings.TrimSpace(oembed.AuthorName)
				}
			}
		}
	}

	// 2. Prioritize official uncropped full-resolution cover (maxresdefault -> sddefault -> hqdefault)
	coverCandidates := []string{
		fmt.Sprintf("https://i.ytimg.com/vi/%s/maxresdefault.jpg", info.VideoID),
		fmt.Sprintf("https://i.ytimg.com/vi/%s/sddefault.jpg", info.VideoID),
		fmt.Sprintf("https://i.ytimg.com/vi/%s/hqdefault.jpg", info.VideoID),
		fmt.Sprintf("https://img.youtube.com/vi/%s/hqdefault.jpg", info.VideoID),
	}

	for _, candURL := range coverCandidates {
		coverData, mime, err := downloadImage(ctx, candURL, "https://www.youtube.com/")
		if err == nil && len(coverData) > 0 {
			res.CoverURL = candURL
			res.CoverData = coverData
			res.CoverMime = mime
			res.CoverFileName = "thumbnail.jpg"
			break
		}
	}

	return res, nil
}

func downloadImage(ctx context.Context, imgURL string, referer string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", imgURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	if referer != "" {
		req.Header.Set("Referer", referer)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download image status: %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	mime := resp.Header.Get("Content-Type")
	if mime == "" || !strings.HasPrefix(mime, "image/") {
		mime = http.DetectContentType(data)
	}
	if !strings.HasPrefix(mime, "image/") {
		mime = "image/jpeg"
	}

	return data, mime, nil
}
