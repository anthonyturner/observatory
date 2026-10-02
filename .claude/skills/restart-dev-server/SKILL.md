---
name: restart-dev-server
description: Restart this checkout's local dev server (`npm start` - the API plus the Angular site) when the site loads but its API calls fail, for example "can't find the API", the review queue won't load, or nothing answers on the API port. Finds the right process group, stops it with taskkill, and starts `npm start` again in its own window. Do not use for a deployed (Vercel) API, for a failing build or test run, or to stop a server that belongs to another checkout or worktree without asking first.
---

# Restart the dev server

`npm start` runs `concurrently`, which starts two children: `npm run api`
(`node --watch server/main.ts`) and `ng serve`. The site proxies `/api` to the
API; the port is in `proxy.conf.json` (4319 at the time of writing), and the
site is on 4200.

The usual failure: the API crashes, but its `node --watch` wrapper stays alive
with no `server/main.ts` child under it. Nothing listens on the API port, the
site still loads, and every `/api/*` call fails. Saving a file does not reliably
bring it back. The fix is to stop the whole group and run `npm start` again.

Run every step in PowerShell, from the checkout root.

## Setup

Each agent shell call starts fresh, so variables and functions don't carry
over from one call to the next. **Begin every step's command with this
block.** It also reloads the process list, so later steps never check against
a list from before the restart.

```powershell
$apiPort = 4319; $webPort = 4200
$checkout = (git rev-parse --show-toplevel) -replace '/', '\'
$all = Get-CimInstance Win32_Process
function Get-GroupRoot([int]$id) {
  $p = $all | Where-Object ProcessId -eq $id
  while ($p) {
    if ($p.CommandLine -match 'concurrently\\dist\\bin') { return $p }
    $p = $all | Where-Object ProcessId -eq $p.ParentProcessId
  }
}
function Test-Ours($group) { $group.CommandLine -like "*$checkout\node_modules\*" }
```

## 1. Diagnose

```powershell
Get-NetTCPConnection -State Listen -LocalPort $apiPort, $webPort -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess
try { (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$apiPort/api/queue" -TimeoutSec 10).StatusCode }
catch { $_.Exception.Message }
```

Any HTTP status, even 400 or 404, means the API is up. "Unable to connect"
means it is down. If the API answers and the site is listening, the server is
not the problem: say so and stop.

## 2. Find the process groups

A group is identified by its `concurrently` process. That process's command line
contains the checkout it was started from
(`<checkout>\node_modules\.bin\..\concurrently`), which tells this checkout
apart from a worktree under `.claude\worktrees\`.

```powershell
$all | Where-Object { $_.CommandLine -match 'concurrently\\dist\\bin' } |
  Select-Object ProcessId, CreationDate, @{ n = 'Ours'; e = { Test-Ours $_ } }, CommandLine |
  Format-List
```

For each port that is listening, run `Get-GroupRoot <OwningProcess>` to see
which group holds it. A group from this checkout whose
`node --watch server/main.ts` has no child `node` process has a dead API.

## 3. Decide what to stop

- **This checkout's group** (`Test-Ours` is true; a worktree's group runs from
  `.claude\worktrees\<name>\node_modules` and is not ours): stop it.
- **Another checkout's group**, for example an agent worktree holding the API
  port: **do not stop it. Ask the user first.** Another session may be using
  it. Say which worktree it is and when it started.
- **No group, but a bare process holds the port** (no `concurrently` above
  it): show its command line and ask before you stop it.

## 4. Stop the group

```powershell
taskkill /PID <concurrently-pid> /T /F
```

`/T` takes the whole tree: the API wrapper, the server and `ng serve`. If
taskkill says the process was not found, the group has already exited. Run
steps 1 and 2 again before doing anything else, because something else may
have started in the meantime.

## 5. Start it again

Start it in its own titled window, so it does not depend on this session and
the user can stop it with Ctrl+C:

```powershell
Start-Process cmd.exe -ArgumentList '/k', 'title Observatory (npm start) && npm start' -WorkingDirectory $checkout
```

Do not start it as a background task of the agent session: that task stops
when the session's time limit is reached.

## 6. Verify

```powershell
$deadline = (Get-Date).AddSeconds(120)
do {
  Start-Sleep 3
  $up = Get-NetTCPConnection -State Listen -LocalPort $apiPort, $webPort -ErrorAction SilentlyContinue
} until ((($up.LocalPort | Sort-Object -Unique).Count -eq 2) -or (Get-Date) -gt $deadline)
$up | Select-Object LocalPort, OwningProcess
```

Then run the probe from step 1 again. Check that both ports belong to the new
group (`Get-GroupRoot`), not to another checkout. If the API port is still free
after two minutes, the API is failing on startup: run `node server/main.ts` once
in the foreground to see the error, and report it.

## Report

Tell the user what was down, which group was stopped (by PID), the title of the
new window, and whether both ports answer.
