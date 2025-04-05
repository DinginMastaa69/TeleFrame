# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run Commands
- `npm start` - Run TeleFrame with Electron
- `npm run botonly` - Run only the Telegram bot component
- `npm run install` - Run installation script

## Code Style Guidelines
- **Imports:** Group related imports. Node.js built-ins first, then external packages, then local imports.
- **Formatting:** Use 2-space indentation. Semi-colons required.
- **Comments:** Use JSDoc style for function documentation. Add explanatory comments for complex logic.
- **Naming:** Use camelCase for variables and functions, PascalCase for classes.
- **Error Handling:** Use try/catch for error handling with appropriate logging via Winston.
- **Logging:** Use the logger module with appropriate log levels (info, warn, error).
- **Variable Declaration:** Use `const` by default, `let` when needed. Avoid `var`.
- **Functions:** Prefer arrow functions for callbacks and function expressions.
- **Modules:** Use CommonJS module pattern with standard export at bottom of files.