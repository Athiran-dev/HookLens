//go:build !windows

package main

// vtEnabled reports whether the terminal understands ANSI colour sequences (true everywhere but old Windows consoles).
var vtEnabled = true
