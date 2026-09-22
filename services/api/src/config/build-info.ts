const packageMetadata = require("../../package.json") as {
  version?: string;
};

export const APP_VERSION =
  typeof packageMetadata.version === "string" && packageMetadata.version.trim()
    ? packageMetadata.version.trim()
    : "unknown";


export const APP_RELEASE =
  typeof process.env.APP_BUILD_SHA === "string" &&
  process.env.APP_BUILD_SHA.trim()
    ? process.env.APP_BUILD_SHA.trim()
    : "unknown";
