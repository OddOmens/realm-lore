// Command realmlore runs the Realm Lore server.
//
//	realmlore                         serve the app (same as "realmlore serve")
//	realmlore import <folder|.tar.gz> [--overwrite]
//	                                  bring in what export-from-mac.sh packed up
//	realmlore healthcheck             exit 0 if the server answers (for Docker)
//
// Settings come from the environment:
//
//	REALMLORE_PASSWORD        the password to sign in with (or REALMLORE_PASSWORD_FILE)
//	REALMLORE_DATA_DIR        where worlds, stamps and backups live (default /data)
//	REALMLORE_ADDR            address to listen on (default :8080)
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/oddomens/realm-lore/internal/auth"
	"github.com/oddomens/realm-lore/internal/server"
	"github.com/oddomens/realm-lore/internal/state"
	"github.com/oddomens/realm-lore/internal/transfer"
	"github.com/oddomens/realm-lore/internal/webui"
	"github.com/oddomens/realm-lore/internal/worlds"
)

var version = "dev"

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	var err error
	switch cmd {
	case "serve":
		err = serve()
	case "import":
		err = runImport(os.Args[2:])
	case "healthcheck":
		err = healthcheck()
	case "version", "--version":
		fmt.Println(version)
	default:
		err = fmt.Errorf("unknown command %q (use serve, import or healthcheck)", cmd)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "realmlore:", err)
		os.Exit(1)
	}
}

func dataDir() (string, error) {
	dir := env("REALMLORE_DATA_DIR", "/data")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("can't use data folder %s: %w", dir, err)
	}
	probe, err := os.CreateTemp(dir, ".write-test-")
	if err != nil {
		return "", fmt.Errorf("can't write to the data folder %s as user %d. Make the host folder you mounted there belong to that user (e.g. sudo chown -R %d:%d ./data)", dir, os.Getuid(), os.Getuid(), os.Getgid())
	}
	probe.Close()
	os.Remove(probe.Name())
	return dir, nil
}

func password() (string, error) {
	if f := os.Getenv("REALMLORE_PASSWORD_FILE"); f != "" {
		b, err := os.ReadFile(f)
		if err != nil {
			return "", fmt.Errorf("reading REALMLORE_PASSWORD_FILE: %w", err)
		}
		return strings.TrimRight(string(b), "\r\n"), nil
	}
	p := os.Getenv("REALMLORE_PASSWORD")
	if p == "" {
		return "", errors.New("set REALMLORE_PASSWORD (or REALMLORE_PASSWORD_FILE) to the password you'll sign in with")
	}
	return p, nil
}

func serve() error {
	dir, err := dataDir()
	if err != nil {
		return err
	}
	pw, err := password()
	if err != nil {
		return err
	}
	if len(pw) < 8 {
		log.Printf("warning: REALMLORE_PASSWORD is shorter than 8 characters")
	}
	a, err := auth.New(dir, pw)
	if err != nil {
		return err
	}
	store := &worlds.Store{DataDir: dir}
	store.CleanStaging()
	srv := &server.Server{Store: store, State: state.New(dir), Auth: a, WebUI: webui.FS(), Version: version}

	addr := env("REALMLORE_ADDR", ":8080")
	hs := &http.Server{
		Addr:              addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go srv.RunBackups(ctx.Done())
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		hs.Shutdown(shutdown)
	}()

	log.Printf("Realm Lore %s listening on %s, data in %s", version, addr, dir)
	if err := hs.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func runImport(args []string) error {
	var src string
	opt := transfer.Options{}
	for _, a := range args {
		switch a {
		case "--overwrite":
			opt.Overwrite = true
		default:
			src = a
		}
	}
	if src == "" {
		return errors.New("usage: realmlore import <folder or .tar.gz from export-from-mac.sh> [--overwrite]")
	}
	dir, err := dataDir()
	if err != nil {
		return err
	}
	fmt.Printf("Importing into %s\n", dir)
	if err := transfer.Import(src, &worlds.Store{DataDir: dir}, state.New(dir), opt, os.Stdout); err != nil {
		return err
	}
	fmt.Println("Done.")
	return nil
}

func healthcheck() error {
	addr := env("REALMLORE_ADDR", ":8080")
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}
	c := http.Client{Timeout: 3 * time.Second}
	res, err := c.Get("http://" + addr + "/api/health")
	if err != nil {
		return err
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned %d", res.StatusCode)
	}
	return nil
}
