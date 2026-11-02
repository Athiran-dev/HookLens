package main

import (
	"fmt"
	"strings"
)

// logoArt is the HookLens mark rendered with half-block characters
// (generated from web/public/mark-white.png).
const logoArt = `
            ▄▄█        █▄
         ▄▄████        ████▄
        ███████        ██████
        ▀▀█████        ██████  ▄▄▄
        ▄▄ ▀███▄▄   ▄▄███████  ▀▀██▄
  █████████   ████ ██████████     ██
        ▀▀ ▄███▀▀    ▀███████    ▄██
        ▄██████        ██████  ███▀
        ███████        ██████  ▀▀▀
         ▀▀████        ████▀
            ▀▀▀        █▀`

// printLogo prints the mark (orange when the terminal supports colour) followed by the product line.
func printLogo(subtitle string) {
	for _, line := range strings.Split(logoArt, "\n") {
		fmt.Println(paint(line, "38;5;208"))
	}
	fmt.Println()
	fmt.Printf("  %s  %s\n", paint("HOOKLENS", "1"), subtitle)
	fmt.Println()
}
