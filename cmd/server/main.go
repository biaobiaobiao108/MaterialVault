package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"materialvault/internal/config"
	"materialvault/internal/db"
	"materialvault/internal/handlers"
)

func main() {
	portFlag := flag.String("port", "", "HTTP server port (default 3000 or env PORT)")
	seedFlag := flag.Bool("seed", false, "Force run database seeder")
	flag.Parse()

	cfg := config.LoadConfig()
	if *portFlag != "" {
		cfg.Port = *portFlag
	}

	// 1. Initialize SQLite Database & FTS5
	sqlDB, err := db.InitDatabase(cfg.DbPath)
	if err != nil {
		log.Fatalf("[Fatal] Database initialization failed: %v", err)
	}
	defer sqlDB.Close()

	// 2. Run Seeder
	if err := db.Seed(); err != nil {
		log.Printf("[Seed Warning] %v", err)
	}
	if *seedFlag {
		log.Println("[Seed] Seeder execution finished.")
		return
	}

	// 3. Build HTTP Router (no embedded FS in dev mode, falls back to disk dist/ and public/)
	router := handlers.NewRouter(cfg, nil)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 4. Graceful Shutdown listener
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Material Vault Go Server] Running on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Fatal] Server error: %v", err)
		}
	}()

	<-stopChan
	log.Println("[Server] Shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Server] Forced shutdown: %v", err)
	}
	log.Println("[Server] Server stopped successfully.")
}
