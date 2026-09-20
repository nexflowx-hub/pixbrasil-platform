const packageMetadata = require("../../package.json") as {
  version?: string;
};

export const APP_VERSION =
  typeof packageMetadata.version === "string" && packageMetadata.version.trim()
    ? packageMetadata.version.trim()
    : "unknown";
