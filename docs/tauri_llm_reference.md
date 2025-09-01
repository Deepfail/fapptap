# Tauri 2.0 Quick Reference for LLM

Generated: 2025-09-01T04:16:53.033470
Total concepts: 28
Total commands: 135
Total workflows: 16

## Quick Command Reference

- **tauri_dev**: `tauri dev` - This file is used by the Tauri runtime and the Tauri CLI. You can define build settings (such as the [command run before `tauri build`][before-build-command] or [`
- **tauri_build**: `tauri build` - This file is used by the Tauri runtime and the Tauri CLI. You can define build settings (such as the [command run before `
- **tauri_init**: `tauri init` - npm="npx
- **tauri_migrate**: `npm run tauri migrate` - npm="npm install @tauri-apps/cli@latest
- **tauri_add_fs**: `pnpm tauri add fs` - If it is an existing plugin from our workspace you can use the automated way:
- **tauri_icon**: `npm run tauri icon` - npm="

## Essential Concepts

- **Create a Project** (general): import { Steps } from '@astrojs/starlight/components';
- **Calling the Frontend from Rust** (general): The `@tauri-apps/api` NPM package offers APIs to listen to both global and webview-specific events.
- **Configuration Files** (communication): import CommandTabs from '@components/CommandTabs.astro';

## Tauri v2 Changes & Migration

## Permissions & Capabilities

### Core Permissions

- **Core Permissions**: A list of all permissions that can be used with the core of the Tauri framework....

### Capability Patterns

- **json**: `{
    "identifier": "fs-read-home",
    "description": "Allow access file access to home directo...`
- **json**: `{
      "identifier": "dialog",
      "description": "Allow to open a dialog",
      "local": true,
...`

## Worker & Sidecar Patterns

### Sidecar Execution

- **javascript**: command

  ```javascript
  import { Command } from '@tauri-apps/plugin-shell';

        const message = 'Tauri';

        const command = Command.sidecar('binaries/app', ['ping'...
  ```

- **rust**: command
  ```rust
  #[tauri::command]
        async fn ping(app: tauri::AppHandle, message: String) -> String {
          let sidecar_command = app
            .shell()
  ...
  ```

## Plugin Usage

### Available Plugins

- **Using Plugin Permissions**: import { Steps } from '@astrojs/starlight/components'; import ShowSolution from '@components/ShowSol...

### Plugin Usage Patterns

- **@tauri-apps/plugin-cli** (json)
  ```json
  // package.json
  {
  "dependencies": {
    "@tauri-apps/plugin-cli": "^2.0.0"
  }
  }...
  ```
- **@tauri-apps/plugin-cli** (javascript)
  ```javascript
  import { getMatches } from '@tauri-apps/plugin-cli';
  const matches = await getMatches();...
  ```
- **@tauri-apps/plugin-clipboard-manager** (json)
  ```json
  // package.json
  {
  "dependencies": {
    "@tauri-apps/plugin-clipboard-manager": "^2.0.0"
  }
  }...
  ```

## Common Patterns

- **plugin_usage** (used 77 times)
- **command_definition** (used 60 times)
  ```rust
  use tauri::{AppHandle, Emitter};
  ```

#[tauri::command]
fn download(app: AppHandle, url: String) {
app.emit("download-started", &url).unwrap();
for progress in [1, 15, 50, 80, 100] {
app.emit("dow...

````
- **window_manipulation** (used 28 times)
- **command_invocation** (used 28 times)
```ts
import { invoke, Channel } from '@tauri-apps/api/core';

type DownloadEvent =
| {
    event: 'started';
    data: {
      url: string;
      downloadId: number;
      contentLength: number...
````

- **state_initialization** (used 14 times)
- **v2_permissions** (used 13 times)
- **sidecar_execution** (used 11 times)
- **state_management** (used 10 times)
- **v2_window_api** (used 8 times)

## Search Hints

- **how to start**: prerequisites, create-project, develop
- **frontend backend communication**: calling-rust, calling-frontend, commands, events
- **ui customization**: window-customization, system-tray, window-menu, splashscreen
- **security**: capabilities, permissions, core-permissions
- **deployment**: build, icons, resources, sidecar
- **state and data**: state-management, resources
- **debugging**: debug-vscode, environment-variables
- **migration**: migrate-from-tauri-1, migrate-from-tauri-2-beta, updating-dependencies
- **plugins**: using-plugin-permissions, writing-plugin-permissions
