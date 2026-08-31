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

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}

	dataDir := filepath.Join(cwd, "data")
	assetsDir := filepath.Join(dataDir, "assets")
	dbPath := filepath.Join(dataDir, "vault.db")
	distDir := filepath.Join(cwd, "dist")
	publicDir := filepath.Join(cwd, "public")

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
