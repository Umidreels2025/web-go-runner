package main

import (
	"bytes"
	"context"
	"fmt"
	"go/format"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	MaxCodeBytes = 5 << 20 // 5 MB
	CompileTimeout = 10 * time.Second
)

func main() {
	r := gin.Default()
	// Allow larger body up to 6MB safety
	r.MaxMultipartMemory = 6 << 20

	// Simple format endpoint using go/format (no external binary required)
	r.POST("/format", func(c *gin.Context) {
		body, err := io.ReadAll(io.LimitReader(c.Request.Body, MaxCodeBytes))
		if err != nil {
			c.String(http.StatusBadRequest, "read error: %v", err)
			return
		}
		// try formatting with go/format
		out, err := format.Source(body)
		if err != nil {
			c.String(http.StatusBadRequest, "format error: %v", err)
			return
		}
		c.Data(http.StatusOK, "text/plain; charset=utf-8", out)
	})

	// Compile endpoint: accepts raw Go source, builds WASM and returns .wasm binary
	r.POST("/compile", func(c *gin.Context) {
		target := c.Query("target") // expected "wasm" or "wasi"
		if target == "" { target = "wasm" }

		body, err := io.ReadAll(io.LimitReader(c.Request.Body, MaxCodeBytes))
		if err != nil {
			c.String(http.StatusBadRequest, "read error: %v", err)
			return
		}

		// create temp dir
		tmpDir, err := os.MkdirTemp("", "goplay-*")
		if err != nil {
			c.String(http.StatusInternalServerError, "tmpdir error: %v", err)
			return
		}
		defer os.RemoveAll(tmpDir)

		srcPath := filepath.Join(tmpDir, "main.go")
		if err := os.WriteFile(srcPath, body, 0644); err != nil {
			c.String(http.StatusInternalServerError, "write error: %v", err)
			return
		}

		outWasm := filepath.Join(tmpDir, "out.wasm")
		// build command: tinygo build -o out.wasm -target <target> main.go
		ctx, cancel := context.WithTimeout(context.Background(), CompileTimeout)
		defer cancel()
		cmd := exec.CommandContext(ctx, "tinygo", "build", "-o", outWasm, "-target", target, srcPath)

		// ensure we don't inherit large envs; set working dir
		cmd.Dir = tmpDir

		var combined bytes.Buffer
		cmd.Stderr = &combined
		cmd.Stdout = &combined

		if err := cmd.Run(); err != nil {
			// return compiler output and error
			msg := combined.String()
			if msg == "" {
				msg = err.Error()
			}
			c.String(http.StatusBadRequest, "compile error:\n%s", msg)
			return
		}

		// read wasm file
		data, err := os.ReadFile(outWasm)
		if err != nil {
			c.String(http.StatusInternalServerError, "read output error: %v", err)
			return
		}

		// Reply with application/wasm
		c.Data(http.StatusOK, "application/wasm", data)
	})

	// Serve static frontend files (optional) if you want one container to serve frontend
	r.Static("/static", "./web")
	r.GET("/", func(c *gin.Context) {
		c.File("./web/index.html")
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	addr := fmt.Sprintf(":%s", port)
	r.Run(addr)
}
