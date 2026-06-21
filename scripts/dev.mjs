import net from "node:net";
import { spawn } from "node:child_process";

const processes = [];
let shuttingDown = false;

function start(name, command, args, cwd, stdio = "inherit") {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: false,
    stdio,
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
  return child;
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

async function waitForPort(host, port, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port });

      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });

      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (ready) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function waitForUvicornReady(child, timeoutMs = 60_000) {
  let buffer = "";

  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for backend readiness"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      child.off("exit", onExit);
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
    };

    const finish = () => {
      cleanup();
      resolve(undefined);
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Backend exited before becoming ready (${signal ?? code})`));
    };

    const onChunk = (chunk, stream) => {
      const text = chunk.toString();
      stream.write(chunk);
      buffer += text;

      if (buffer.includes("Uvicorn running on http://127.0.0.1:8000")) {
        finish();
      }
    };

    const onStdout = (chunk) => onChunk(chunk, process.stdout);
    const onStderr = (chunk) => onChunk(chunk, process.stderr);

    child.once("exit", onExit);
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
  });
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

const api = start(
  "api",
  "uv",
  ["run", "--project", "backend", "uvicorn", "app.main:app", "--reload", "--app-dir", "backend", "--host", "127.0.0.1", "--port", "8000"],
  process.cwd(),
  ["ignore", "pipe", "pipe"],
);

try {
  console.error("[dev] waiting for backend on 127.0.0.1:8000");
  await waitForUvicornReady(api);
  await waitForPort("127.0.0.1", 8000);
  start("web", "npm", ["--prefix", "client/frontend", "run", "dev"], process.cwd());
} catch (error) {
  console.error("[dev] backend never became ready:", error);
  shutdown();
  process.exit(1);
}
