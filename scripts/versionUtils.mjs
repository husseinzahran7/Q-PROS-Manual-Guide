// Pure version helpers shared by release.mjs (and unit-tested).
//
// setVersionContent does a surgical in-place replacement of the
// "version" value so key order, indentation, and trailing newlines in
// package.json / public/manifest.json are preserved byte-for-byte.
// The old JSON.parse + JSON.stringify round-trip rewrote the whole
// file and could reorder keys.

export function bumpVersion(version, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const [major, minor, patch] = version.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch" || kind === undefined) return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump "${kind}" — use patch | minor | major | x.y.z`);
}

export function setVersionContent(content, next) {
  if (!/"version"\s*:\s*"[^"]*"/.test(content)) {
    throw new Error('No "version" field found to update');
  }
  return content.replace(/("version"\s*:\s*")[^"]*(")/, `$1${next}$2`);
}
