package utils

import (
	"reflect"
	"testing"
)

func TestExtractHashtags(t *testing.T) {
	text := "这是一个关于 #AI工具 和 #视频剪辑 的灵感 #AI工具 #格斗_123"
	tags := ExtractHashtags(text)
	expected := []string{"AI工具", "视频剪辑", "格斗_123"}

	if !reflect.DeepEqual(tags, expected) {
		t.Fatalf("expected %v, got %v", expected, tags)
	}
}

func TestNormalizeURL(t *testing.T) {
	raw := "  bilibili.com/video/BV123?utm_source=share&utm_medium=web&spm_id_from=333.1007&t=10  "
	normalized, domain, err := NormalizeURL(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedURL := "https://bilibili.com/video/BV123?t=10"
	expectedDomain := "bilibili.com"

	if normalized != expectedURL {
		t.Errorf("expected URL %s, got %s", expectedURL, normalized)
	}
	if domain != expectedDomain {
		t.Errorf("expected domain %s, got %s", expectedDomain, domain)
	}
}
