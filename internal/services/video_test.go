package services

import (
	"testing"
)

func TestDetectVideoInfo(t *testing.T) {
	tests := []struct {
		url      string
		expected *VideoInfo
	}{
		{
			url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			expected: &VideoInfo{
				Platform: "youtube",
				VideoID:  "dQw4w9WgXcQ",
				CleanURL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			},
		},
		{
			url: "https://youtu.be/dQw4w9WgXcQ",
			expected: &VideoInfo{
				Platform: "youtube",
				VideoID:  "dQw4w9WgXcQ",
				CleanURL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			},
		},
		{
			url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
			expected: &VideoInfo{
				Platform: "youtube",
				VideoID:  "dQw4w9WgXcQ",
				CleanURL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			},
		},
		{
			url: "https://www.bilibili.com/video/BV1xx411c7mD",
			expected: &VideoInfo{
				Platform: "bilibili",
				VideoID:  "BV1xx411c7mD",
				CleanURL: "https://www.bilibili.com/video/BV1xx411c7mD",
			},
		},
		{
			url: "https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333.999",
			expected: &VideoInfo{
				Platform: "bilibili",
				VideoID:  "BV1xx411c7mD",
				CleanURL: "https://www.bilibili.com/video/BV1xx411c7mD",
			},
		},
		{
			url: "https://www.bilibili.com/video/av170001",
			expected: &VideoInfo{
				Platform: "bilibili",
				VideoID:  "av170001",
				CleanURL: "https://www.bilibili.com/video/av170001",
			},
		},
		{
			url:      "https://github.com/mozilla/readability",
			expected: nil,
		},
		{
			url:      "https://news.ycombinator.com/item?id=12345",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			res := DetectVideoInfo(tt.url)
			if tt.expected == nil {
				if res != nil {
					t.Fatalf("expected nil for %s, got %+v", tt.url, res)
				}
				return
			}
			if res == nil {
				t.Fatalf("expected %+v for %s, got nil", tt.expected, tt.url)
			}
			if res.Platform != tt.expected.Platform || res.VideoID != tt.expected.VideoID || res.CleanURL != tt.expected.CleanURL {
				t.Fatalf("mismatch for %s:\nexpected: %+v\ngot: %+v", tt.url, tt.expected, res)
			}
		})
	}
}
