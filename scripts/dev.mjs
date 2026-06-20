import { spawn } from "node:child_process";

const processes = [];
let shuttingDown = false;

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const exitCode = code ?? (signal ? 1 : 0);
    console.error(`[${name}] exited with ${signal ?? code}`);
    shutdown();
    process.exit(exitCode);
  });

  child.on("error", (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`[${name}] failed to start:`, error);
    shutdown();
    process.exit(1);
  });

  processes.push({ name, child });
}

function shutdown() {
  for (const { child } of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const { child } of processes) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
  }, 5000).unref();
}

process.on("SIGINT", () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  shutdown();
  process.exit(130);
});

process.on("SIGTERM", () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  shutdown();
  process.exit(143);
});

start("api", "python3", ["-m", "uvicorn", "app.main:app", "--reload", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000"], process.cwd());
start("web", "npm", ["--prefix", "client/frontend", "run", "dev"], process.cwd());

