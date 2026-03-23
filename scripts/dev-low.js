const { spawn } = require("node:child_process");
const path = require("node:path");

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const forwardedArgs = process.argv.slice(2);

const existingNodeOptions = (process.env.NODE_OPTIONS || "")
  .split(/\s+/)
  .map((value) => value.trim())
  .filter(Boolean);

if (!existingNodeOptions.some((value) => value.startsWith("--max-old-space-size"))) {
  existingNodeOptions.push("--max-old-space-size=4096");
}

const child = spawn(
  process.execPath,
  [nextBin, "dev", "-p", "3001", "--webpack", "--disable-source-maps", ...forwardedArgs],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: existingNodeOptions.join(" "),
      RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS || "4",
    },
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start low-resource dev server.");
  console.error(error);
  process.exit(1);
});
