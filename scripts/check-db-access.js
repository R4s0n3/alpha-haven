const fs = require("fs");
const path = require("path");

const roots = ["src", path.join("prisma", "schema.prisma")];
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "public",
  "space_haven_assets",
]);
const scannedExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
]);
const bannedPatterns = [
  { label: "$queryRaw", regex: /\$queryRaw/ },
  { label: "$executeRaw", regex: /\$executeRaw/ },
  { label: "Prisma.sql", regex: /Prisma\.sql/ },
  { label: ".upsert(", regex: /\.upsert\s*\(/ },
];

function listFiles(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  const stats = fs.statSync(targetPath);

  if (stats.isFile()) {
    return scannedExtensions.has(path.extname(targetPath)) ? [targetPath] : [];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  return fs.readdirSync(targetPath).flatMap((entry) => {
    if (ignoredDirectories.has(entry)) {
      return [];
    }

    return listFiles(path.join(targetPath, entry));
  });
}

const violations = [];

for (const filePath of roots.flatMap(listFiles)) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of bannedPatterns) {
      if (pattern.regex.test(line)) {
        violations.push({
          filePath,
          lineNumber: index + 1,
          label: pattern.label,
          line: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Banned database access patterns found:");

  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.lineNumber}: ${violation.label}: ${violation.line}`,
    );
  }

  process.exit(1);
}

console.log("No banned database access patterns found.");
