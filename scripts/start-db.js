const { spawnSync } = require("child_process");

const containerName = "space-haven-db";
const volumeName = "space-haven-postgres-data";
const image = "postgres:16-alpine";
const databaseUrl =
  "postgresql://postgres:postgres@localhost:5432/space_haven?schema=public";

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    console.error("Docker is required to start the local database.");
    console.error(result.error.message);
    process.exit(1);
  }

  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result;
}

function containerExists() {
  return (
    runDocker(["container", "inspect", containerName], {
      capture: true,
      allowFailure: true,
    }).status === 0
  );
}

function containerIsRunning() {
  const result = runDocker(
    ["inspect", "--format", "{{.State.Running}}", containerName],
    {
      capture: true,
      allowFailure: true,
    },
  );

  return result.status === 0 && result.stdout.trim() === "true";
}

runDocker(["version"], { capture: true });

if (containerExists()) {
  if (containerIsRunning()) {
    console.log(`${containerName} is already running.`);
  } else {
    runDocker(["start", containerName]);
  }
} else {
  runDocker([
    "run",
    "--detach",
    "--name",
    containerName,
    "--env",
    "POSTGRES_USER=postgres",
    "--env",
    "POSTGRES_PASSWORD=postgres",
    "--env",
    "POSTGRES_DB=space_haven",
    "--publish",
    "5432:5432",
    "--volume",
    `${volumeName}:/var/lib/postgresql/data`,
    image,
  ]);
}

console.log(`Local database URL: ${databaseUrl}`);
console.log("Run `npm run db:push` to apply the Prisma schema.");
