package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port      string
	DataDir   string
	AssetsDir string
	DbPath    string
	DistDir   string
	PublicDir string
}

func findRootDir() string {
	cwd, err := os.Getwd()
	if err == nil {
		// 1. Check current directory
		if _, err := os.Stat(filepath.Join(cwd, "dist", "index.html")); err == nil {
			return cwd
		}
		// 2. Check parent directory (e.g. running from bin/ or cmd/server/)
		if _, err := os.Stat(filepath.Join(cwd, "..", "dist", "index.html")); err == nil {
			return filepath.Clean(filepath.Join(cwd, ".."))
		}
	}

	execPath, err := os.Executable()
	if err == nil {
		execDir := filepath.Dir(execPath)
		if _, err := os.Stat(filepath.Join(execDir, "dist", "index.html")); err == nil {
			return execDir
		}
		if _, err := os.Stat(filepath.Join(execDir, "..", "dist", "index.html")); err == nil {
			return filepath.Clean(filepath.Join(execDir, ".."))
		}
	}

	if cwd != "" {
		return cwd
	}
	return "."
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	root := findRootDir()

	dataDir := filepath.Join(root, "data")
	assetsDir := filepath.Join(dataDir, "assets")
	dbPath := filepath.Join(dataDir, "vault.db")
	distDir := filepath.Join(root, "dist")
	publicDir := filepath.Join(root, "public")

	// Ensure directories exist
	_ = os.MkdirAll(dataDir, 0755)
	_ = os.MkdirAll(assetsDir, 0755)

	return &Config{
		Port:      port,
		DataDir:   dataDir,
		AssetsDir: assetsDir,
		DbPath:    dbPath,
		DistDir:   distDir,
		PublicDir: publicDir,
	}
}
