# DalTime Debugging Guide

## Frontend (Angular)

### Browser DevTools (Recommended)
Open Chrome/Edge DevTools (F12) → Sources tab → set breakpoints in TypeScript files. Angular source maps are enabled by default in dev mode.

### VS Code + Chrome
Add to `.vscode/launch.json`:
```json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Frontend",
  "url": "http://localhost:4200",
  "webRoot": "${workspaceFolder}/frontend/src"
}
```

### Quick & Dirty
Drop `debugger;` anywhere in your code — browser pauses there when DevTools is open.

---

## Backend (SAM Lambda / Node.js)

### SAM Local with Debugger
```bash
sam local start-api -d 5858
```
Then attach VS Code — add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "attach",
  "name": "Debug Lambda",
  "port": 5858,
  "localRoot": "${workspaceFolder}/backend",
  "remoteRoot": "/var/task"
}
```
Set breakpoints in Lambda handlers and step through.

### Jest Test Debugging
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["--runInBand", "${relativeFile}"],
  "cwd": "${workspaceFolder}/backend"
}
```
Open a test file, run this config, and breakpoints in both tests and source code will hit.

---

## Tips
- **Frontend**: Browser DevTools is fastest for most issues. Use VS Code debugger for complex state.
- **Backend**: `console.log` in Lambda handlers prints to the `sam local` terminal. Use the debug port for stepping through tricky logic.
- **Tests**: Use the Jest debug config when a test fails and logs aren't enough.
