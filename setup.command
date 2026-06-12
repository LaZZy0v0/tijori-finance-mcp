#!/bin/bash
# Tijori Finance MCP — Mac setup launcher. Double-click me in Finder.
cd "$(dirname "$0")"

echo
echo "  Tijori Finance MCP — Setup"
echo "  ==========================="
echo

if ! command -v node >/dev/null 2>&1; then
    echo "  ERROR: Node.js is not installed."
    echo
    echo "  Download and install Node.js from:"
    echo "  https://nodejs.org  (choose the LTS version)"
    echo
    echo "  Then double-click this file again."
    echo
    read -n 1 -s -r -p "  Press any key to close..."
    echo
    exit 1
fi

node setup.js
echo
read -n 1 -s -r -p "  Press any key to close..."
echo
