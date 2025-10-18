import { spawn } from "node:child_process";

const children = new Set();
let closing = false;

function spawnScript(name, script) {
  const child = spawn("npm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (closing) {
      if (!children.size) {
        process.exit(code ?? (signal ? 1 : 0));
      }
      return;
    }

    const reason = signal ? `${signal}` : `${code ?? 0}`;
    console.log(`\n[dev] ${name} exited with ${reason}. Stopping remaining processes...`);
    shutdown(code ?? (signal ? 1 : 0));
  });

  child.on("error", (error) => {
    console.error(`\n[dev] Failed to start ${name}:`, error);
    shutdown(1);
  });
}

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }
  if (!children.size) {
    process.exit(code);
  } else {
    const timeout = setTimeout(() => {
      for (const child of children) {
        if (!child.killed) {
          child.kill("SIGTERM");
        }
      }
      process.exit(code);
    }, 2000);
    timeout.unref();
  }
}

process.on("SIGINT", () => {
  console.log("\n[dev] Caught SIGINT. Shutting down...");
  shutdown(130);
});

process.on("SIGTERM", () => {
  console.log("\n[dev] Caught SIGTERM. Shutting down...");
  shutdown(143);
});

spawnScript("backend", "dev:be");
spawnScript("frontend", "dev:fe");
