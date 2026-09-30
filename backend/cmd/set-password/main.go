// Local admin utility. Reads a secret only from stdin, not argv or .env.
// Example: a PowerShell Read-Host -AsSecureString workflow pipes it here.
package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nexa-distributor/erp-backend/internal/config"
	"golang.org/x/crypto/bcrypt"
)

func loadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		pair := strings.SplitN(line, "=", 2)
		if len(pair) != 2 {
			continue
		}
		if _, ok := os.LookupEnv(strings.TrimSpace(pair[0])); !ok {
			_ = os.Setenv(strings.TrimSpace(pair[0]), strings.Trim(strings.TrimSpace(pair[1]), `"`))
		}
	}
	return scanner.Err()
}
func run() error {
	if len(os.Args) != 2 {
		return fmt.Errorf("usage: set-password USERNAME")
	}
	if err := loadDotEnv(".env"); err != nil {
		return fmt.Errorf("backend/.env: %w", err)
	}
	name := strings.TrimSpace(os.Args[1])
	if name == "" {
		return fmt.Errorf("username required")
	}
	scanner := bufio.NewScanner(os.Stdin)
	if !scanner.Scan() {
		return fmt.Errorf("password missing on stdin")
	}
	password := strings.TrimSuffix(scanner.Text(), "\r")
	if len(password) < 12 || len(password) > 72 {
		return fmt.Errorf("password length must be 12 to 72 bytes")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost+2)
	if err != nil {
		return err
	}
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, cfg.PostgresURL())
	if err != nil {
		return err
	}
	defer db.Close()
	tag, err := db.Exec(ctx, `UPDATE erp.users SET password_hash=$2,updated_at=now()
        WHERE lower(username)=lower($1) AND status='ACTIVE'`, name, string(hash))
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("no single ACTIVE user with that username")
	}
	fmt.Println("OK: password hash saved for existing PostgreSQL account; no bootstrap credentials are used.")
	return nil
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
}
