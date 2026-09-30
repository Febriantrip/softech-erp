package platform

import (
	"context"
	"net"
	"time"
)

type DependencyStatus struct {
	Name      string `json:"name"`
	Address   string `json:"address"`
	Reachable bool   `json:"reachable"`
	LatencyMS int64  `json:"latencyMs"`
	Error     string `json:"error,omitempty"`
}

func TCPCheck(ctx context.Context, name, address string, timeout time.Duration) DependencyStatus {
	started := time.Now()
	dialer := net.Dialer{Timeout: timeout}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	status := DependencyStatus{Name: name, Address: address, Reachable: err == nil, LatencyMS: time.Since(started).Milliseconds()}
	if err != nil {
		status.Error = err.Error()
		return status
	}
	_ = conn.Close()
	return status
}
