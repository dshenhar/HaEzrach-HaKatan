#!/bin/sh
# The Playwright MCP server (.mcp.json). A Claude Code cloud session has no Chrome,
# only the Chromium at /opt/pw-browsers, and that Chromium's sandbox cannot start
# in the container; anywhere else the server runs as it comes.
if [ -x /opt/pw-browsers/chromium ]; then
    exec npx -y @playwright/mcp@latest --headless --no-sandbox \
        --executable-path /opt/pw-browsers/chromium "$@"
fi
exec npx -y @playwright/mcp@latest "$@"
