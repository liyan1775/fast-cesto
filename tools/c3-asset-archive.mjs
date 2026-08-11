import {
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const COPY_BUFFER_SIZE = 1024 * 1024;

function usage() {
  console.error(`Usage:
  node c3-asset-archive.mjs inspect <assets.dat> [--json]
  node c3-asset-archive.mjs extract <assets.dat> <entry-name> <output-file>
  node c3-asset-archive.mjs repack <assets.dat> <output-file> [--replace <entry-name> <replacement-file>]...`);
}

function readExactly(fd, length, position) {
  const buffer = Buffer.allocUnsafe(length);
  let offset = 0;

  while (offset < length) {
    const count = readSync(fd, buffer, offset, length - offset, position + offset);
    if (count === 0) {
      throw new Error(`Unexpected end of file at offset ${position + offset}`);
    }
    offset += count;
  }

  return buffer;
}

function toSafeNumber(value, label) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large for this tool: ${value}`);
  }
  return Number(value);
}

export function parseArchive(archivePath) {
  const fd = openSync(archivePath, "r");

  try {
    const stat = fstatSync(fd);
    const header = readExactly(fd, 16, 0);

    if (header.toString("ascii", 0, 4) !== "c3ab") {
      throw new Error("Not a Construct 3 assets.dat archive (missing c3ab magic)");
    }

    const directoryOffset = header.readUInt32BE(8);
    const directoryHeader = readExactly(fd, 12, directoryOffset);

    if (directoryHeader.toString("ascii", 0, 4) !== "fdir") {
      throw new Error(`Missing fdir chunk at offset ${directoryOffset}`);
    }

    const directorySize = toSafeNumber(
      directoryHeader.readBigUInt64BE(4),
      "Directory size",
    );
    const directoryData = readExactly(fd, directorySize, directoryOffset + 12);
    const entryCount = directoryData.readUInt32BE(0);
    const entries = [];
    let cursor = 4;

    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 37 > directoryData.length) {
        throw new Error(`Directory entry ${index} is truncated`);
      }

      const field0 = directoryData.readBigUInt64BE(cursor);
      const offset = directoryData.readBigUInt64BE(cursor + 8);
      const storedSize = directoryData.readBigUInt64BE(cursor + 16);
      const originalSize = directoryData.readBigUInt64BE(cursor + 24);
      const flags = directoryData.readUInt32BE(cursor + 32);
      const nameLength = directoryData.readUInt8(cursor + 36);
      cursor += 37;

      if (cursor + nameLength > directoryData.length) {
        throw new Error(`Directory entry ${index} has a truncated name`);
      }

      const name = directoryData.toString("utf8", cursor, cursor + nameLength);
      cursor += nameLength;

      entries.push({
        index,
        field0,
        offset,
        storedSize,
        originalSize,
        flags,
        name,
      });
    }

    if (cursor !== directoryData.length) {
      throw new Error(
        `Directory parse ended at ${cursor}, expected ${directoryData.length}`,
      );
    }

    const blobHeaderOffset = directoryOffset + 12 + directorySize;
    const blobHeader = readExactly(fd, 12, blobHeaderOffset);

    if (blobHeader.toString("ascii", 0, 4) !== "blob") {
      throw new Error(`Missing blob chunk at offset ${blobHeaderOffset}`);
    }

    const blobSize = blobHeader.readBigUInt64BE(4);
    const blobOffset = blobHeaderOffset + 12;
    const expectedFileSize = BigInt(blobOffset) + blobSize;

    if (expectedFileSize !== BigInt(stat.size)) {
      throw new Error(
        `Archive size mismatch: header describes ${expectedFileSize}, file has ${stat.size}`,
      );
    }

    let expectedOffset = 0n;
    const names = new Set();

    for (const entry of entries) {
      if (names.has(entry.name)) {
        throw new Error(`Duplicate archive entry: ${entry.name}`);
      }
      names.add(entry.name);

      if (entry.offset !== expectedOffset) {
        throw new Error(
          `Non-contiguous blob at ${entry.name}: expected ${expectedOffset}, got ${entry.offset}`,
        );
      }

      if (entry.offset + entry.storedSize > blobSize) {
        throw new Error(`Entry extends past blob: ${entry.name}`);
      }

      expectedOffset += entry.storedSize;
    }

    if (expectedOffset !== blobSize) {
      throw new Error(`Entries total ${expectedOffset}, blob size is ${blobSize}`);
    }

    return {
      archivePath,
      header,
      directoryOffset,
      directorySize,
      blobHeaderOffset,
      blobOffset,
      blobSize,
      entries,
      fileSize: stat.size,
    };
  } finally {
    closeSync(fd);
  }
}

function findEntry(archive, name) {
  const entry = archive.entries.find((candidate) => candidate.name === name);
  if (!entry) {
    throw new Error(`Archive entry not found: ${name}`);
  }
  return entry;
}

export function readEntry(archive, entryName) {
  const entry = findEntry(archive, entryName);
  const size = toSafeNumber(entry.storedSize, `${entryName} size`);
  const fd = openSync(archive.archivePath, "r");

  try {
    return readExactly(
      fd,
      size,
      archive.blobOffset + toSafeNumber(entry.offset, `${entryName} offset`),
    );
  } finally {
    closeSync(fd);
  }
}

export function extractEntry(archive, entryName, outputPath) {
  writeFileSync(outputPath, readEntry(archive, entryName), { flag: "wx" });
}

function buildDirectory(entries) {
  const nameBuffers = entries.map((entry) => Buffer.from(entry.name, "utf8"));
  for (const [index, nameBuffer] of nameBuffers.entries()) {
    if (nameBuffer.length > 255) {
      throw new Error(`Entry name is too long: ${entries[index].name}`);
    }
  }

  const directorySize = 4 + nameBuffers.reduce(
    (total, nameBuffer) => total + 37 + nameBuffer.length,
    0,
  );
  const output = Buffer.alloc(directorySize);
  output.writeUInt32BE(entries.length, 0);
  let cursor = 4;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const nameBuffer = nameBuffers[index];
    output.writeBigUInt64BE(entry.field0, cursor);
    output.writeBigUInt64BE(entry.offset, cursor + 8);
    output.writeBigUInt64BE(entry.storedSize, cursor + 16);
    output.writeBigUInt64BE(entry.originalSize, cursor + 24);
    output.writeUInt32BE(entry.flags, cursor + 32);
    output.writeUInt8(nameBuffer.length, cursor + 36);
    cursor += 37;
    nameBuffer.copy(output, cursor);
    cursor += nameBuffer.length;
  }

  return output;
}

function writeBuffer(fd, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    offset += writeSync(fd, buffer, offset, buffer.length - offset);
  }
}

function copyRange(inputFd, outputFd, inputPosition, size) {
  const buffer = Buffer.allocUnsafe(COPY_BUFFER_SIZE);
  let remaining = size;
  let position = inputPosition;

  while (remaining > 0n) {
    const length = Number(
      remaining > BigInt(buffer.length) ? BigInt(buffer.length) : remaining,
    );
    const count = readSync(inputFd, buffer, 0, length, position);
    if (count === 0) {
      throw new Error(`Unexpected end of file while copying at ${position}`);
    }
    writeBuffer(outputFd, buffer.subarray(0, count));
    position += count;
    remaining -= BigInt(count);
  }
}

export function repackArchive(archive, outputPath, replacementPaths) {
  const replacements = new Map();

  for (const [entryName, replacementPath] of replacementPaths) {
    if (replacements.has(entryName)) {
      throw new Error(`Replacement specified more than once: ${entryName}`);
    }
    const entry = findEntry(archive, entryName);
    if (entry.flags !== 0 || entry.storedSize !== entry.originalSize) {
      throw new Error(`Compressed/encoded entry replacement is unsupported: ${entryName}`);
    }
    replacements.set(entryName, {
      path: replacementPath,
      size: BigInt(statReplacement(replacementPath).size),
    });
  }

  let nextOffset = 0n;
  const outputEntries = archive.entries.map((entry) => {
    const replacement = replacements.get(entry.name);
    const size = replacement ? replacement.size : entry.storedSize;
    const updated = {
      ...entry,
      offset: nextOffset,
      storedSize: size,
      originalSize: replacement ? size : entry.originalSize,
    };
    nextOffset += size;
    return updated;
  });

  const directoryData = buildDirectory(outputEntries);
  const directoryHeader = Buffer.alloc(12);
  directoryHeader.write("fdir", 0, "ascii");
  directoryHeader.writeBigUInt64BE(BigInt(directoryData.length), 4);
  const blobHeader = Buffer.alloc(12);
  blobHeader.write("blob", 0, "ascii");
  blobHeader.writeBigUInt64BE(nextOffset, 4);

  const inputFd = openSync(archive.archivePath, "r");
  const outputFd = openSync(outputPath, "wx");

  try {
    writeBuffer(outputFd, archive.header);
    writeBuffer(outputFd, directoryHeader);
    writeBuffer(outputFd, directoryData);
    writeBuffer(outputFd, blobHeader);

    for (const entry of archive.entries) {
      const replacement = replacements.get(entry.name);
      if (replacement) {
        const replacementFd = openSync(replacement.path, "r");
        try {
          copyRange(replacementFd, outputFd, 0, replacement.size);
        } finally {
          closeSync(replacementFd);
        }
      } else {
        copyRange(
          inputFd,
          outputFd,
          archive.blobOffset + toSafeNumber(entry.offset, `${entry.name} offset`),
          entry.storedSize,
        );
      }
    }
  } finally {
    closeSync(outputFd);
    closeSync(inputFd);
  }
}

function statReplacement(path) {
  const fd = openSync(path, "r");
  try {
    return fstatSync(fd);
  } finally {
    closeSync(fd);
  }
}

function parseReplacementArgs(args) {
  const replacements = [];
  let index = 0;

  while (index < args.length) {
    if (args[index] !== "--replace" || index + 2 >= args.length) {
      throw new Error(`Invalid repack argument near: ${args[index] ?? "<end>"}`);
    }
    replacements.push([args[index + 1], args[index + 2]]);
    index += 3;
  }

  return replacements;
}

function main() {
  const [, , command, archivePath, ...args] = process.argv;
  if (!command || !archivePath) {
    usage();
    process.exit(2);
  }

  const archive = parseArchive(archivePath);

  if (command === "inspect") {
    const json = args.includes("--json");
    const report = {
      fileSize: archive.fileSize,
      directoryOffset: archive.directoryOffset,
      directorySize: archive.directorySize,
      blobOffset: archive.blobOffset,
      blobSize: archive.blobSize.toString(),
      entryCount: archive.entries.length,
      entries: archive.entries.map((entry) => ({
        index: entry.index,
        offset: entry.offset.toString(),
        storedSize: entry.storedSize.toString(),
        originalSize: entry.originalSize.toString(),
        flags: entry.flags,
        name: entry.name,
      })),
    };

    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`entries=${report.entryCount}`);
      console.log(`directoryOffset=${report.directoryOffset}`);
      console.log(`directorySize=${report.directorySize}`);
      console.log(`blobOffset=${report.blobOffset}`);
      console.log(`blobSize=${report.blobSize}`);
      for (const entry of report.entries) {
        console.log(`${entry.index}\t${entry.offset}\t${entry.storedSize}\t${entry.name}`);
      }
    }
    return;
  }

  if (command === "extract") {
    if (args.length !== 2) {
      usage();
      process.exit(2);
    }
    extractEntry(archive, args[0], args[1]);
    return;
  }

  if (command === "repack") {
    if (args.length < 1) {
      usage();
      process.exit(2);
    }
    const [outputPath, ...replacementArgs] = args;
    repackArchive(archive, outputPath, parseReplacementArgs(replacementArgs));
    return;
  }

  usage();
  process.exit(2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}
