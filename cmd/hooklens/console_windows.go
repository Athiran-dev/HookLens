//go:build windows

package main

import (
	"os"
	"syscall"
	"unsafe"
)

// vtEnabled reports whether the console understands ANSI colour sequences.
var vtEnabled bool

func init() {
	k := syscall.NewLazyDLL("kernel32.dll")
	// Windows consoles default to an OEM code page, which garbles the UTF-8 logo and check marks.
	_, _, _ = k.NewProc("SetConsoleOutputCP").Call(65001)

	var mode uint32
	h := os.Stdout.Fd()
	if r, _, _ := k.NewProc("GetConsoleMode").Call(h, uintptr(unsafe.Pointer(&mode))); r != 0 {
		const enableVirtualTerminalProcessing = 0x0004
		if r, _, _ := k.NewProc("SetConsoleMode").Call(h, uintptr(mode|enableVirtualTerminalProcessing)); r != 0 {
			vtEnabled = true
		}
	}
}
