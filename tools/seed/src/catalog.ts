import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

export type CatalogAsset = {
  id: string;
  title: string;
  type: "video";
  source: {
    url: string;
  };
};

export type DevassetCatalog = {
  version: 1;
  assets: CatalogAsset[];
};

type JsonObject = Record<string, unknown>;

const catalogKeys = new Set(["version", "assets"]);
const assetKeys = new Set(["id", "title", "type", "source"]);
const sourceKeys = new Set(["url"]);
const idPattern = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;

export async function loadCatalog(catalogPath: string): Promise<DevassetCatalog> {
  const source = await readFile(catalogPath, "utf8");
  return validateCatalog(parseYaml(source), catalogPath);
}

export function catalogIdentity(catalog: DevassetCatalog): string {
  const identityPairs = catalog.assets
    .map((asset) => ({ id: asset.id, url: asset.source.url }))
    .sort((left, right) => {
      const idComparison = left.id.localeCompare(right.id);
      return idComparison === 0 ? left.url.localeCompare(right.url) : idComparison;
    });

  return hashIdentity(identityPairs);
}

export function assetIdentity(asset: CatalogAsset): string {
  return hashIdentity({ id: asset.id, url: asset.source.url });
}

export function shortIdentity(identity: string): string {
  return identity.replace(/^sha256:/, "").slice(0, 16);
}

function validateCatalog(value: unknown, catalogPath: string): DevassetCatalog {
  const catalog = expectObject(value, "catalog");
  rejectUnexpectedKeys(catalog, catalogKeys, "catalog");

  if (catalog.version !== 1) {
    throw new Error(`${catalogPath}: catalog.version must be 1`);
  }

  if (!Array.isArray(catalog.assets) || catalog.assets.length === 0) {
    throw new Error(`${catalogPath}: catalog.assets must contain at least one asset`);
  }

  const seenIds = new Set<string>();
  const assets = catalog.assets.map((assetValue, index) => {
    const location = `catalog.assets[${index}]`;
    const asset = expectObject(assetValue, location);
    rejectUnexpectedKeys(asset, assetKeys, location);

    const id = expectString(asset.id, `${location}.id`);
    const title = expectString(asset.title, `${location}.title`);
    const type = expectString(asset.type, `${location}.type`);
    const source = expectObject(asset.source, `${location}.source`);
    rejectUnexpectedKeys(source, sourceKeys, `${location}.source`);
    const url = expectString(source.url, `${location}.source.url`);

    if (!idPattern.test(id)) {
      throw new Error(
        `${catalogPath}: ${location}.id must be a lowercase slug containing only letters, numbers, and hyphens`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(`${catalogPath}: duplicate asset id "${id}"`);
    }
    seenIds.add(id);

    if (title.trim() === "") {
      throw new Error(`${catalogPath}: ${location}.title must not be empty`);
    }

    if (type !== "video") {
      throw new Error(`${catalogPath}: ${location}.type must be "video"`);
    }

    validateSourceUrl(url, `${catalogPath}: ${location}.source.url`);

    return {
      id,
      title,
      type: "video" as const,
      source: { url }
    };
  });

  return {
    version: 1,
    assets
  };
}

function validateSourceUrl(value: string, location: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${location} must be an absolute http or https URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${location} must use http or https; local file paths are not supported`);
  }
}

function hashIdentity(value: unknown): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
  return `sha256:${hash}`;
}

function expectObject(value: unknown, location: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }

  return value as JsonObject;
}

function expectString(value: unknown, location: string): string {
  if (typeof value !== "string") {
    throw new Error(`${location} must be a string`);
  }

  return value;
}

function rejectUnexpectedKeys(
  value: JsonObject,
  allowedKeys: Set<string>,
  location: string
): void {
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(
      `${location} contains unsupported field(s): ${unexpectedKeys.join(", ")}`
    );
  }
}
