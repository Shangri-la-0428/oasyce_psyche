#!/usr/bin/env node

import { runMcpServer } from "./mcp.js";

runMcpServer().catch((err) => {
  process.stderr.write(`psyche-mcp fatal: ${err}\n`);
  process.exit(1);
});
