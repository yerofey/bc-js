import { access, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import sort from 'alphanum-sort';
import crypto from 'crypto';

export async function checkAndCreateDirectory(dirPath) {
  try {
    await access(dirPath);
  } catch (error) {
    await mkdir(dirPath);
  }
}

export function getObjectHash(object) {
  const jsonString = JSON.stringify(object);
  const hash = crypto.createHash('sha1');
  hash.update(jsonString);
  return hash.digest('hex');
}

export async function getFilesFromFolder(folderPath, prefix) {
  try {
    const files = await readdir(folderPath);
    const filteredFiles =
      prefix !== undefined
        ? files.filter((file) => file.startsWith(prefix))
        : files;
    return filteredFiles;
  } catch (err) {
    console.error('Error:', err);
    return {};
  }
}

export async function getLatestFileInFolder(folderPath, prefix) {
  let files = await readdir(folderPath);
  files = files.filter((file) => !file.startsWith('.'));
  if (prefix !== undefined) {
    files = files.filter((file) => file.startsWith(prefix));
  }
  files = sort(files, { insensitive: true }).reverse();
  return files[0];
}

export async function readJsonFile(filePath) {
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading file:', err);
    return {};
  }
}

export async function saveJsonFile(filePath, data) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    await writeFile(filePath, jsonString, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing file:', err);
    return false;
  }
}

export async function objectHasAllKeys(json, requiredKeys) {
  return requiredKeys.every((key) => key in json);
}

export function getMaxArrayValue(array) {
  return Math.max(...array.map((element) => element));
}

export function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getTwoUniqueRandomInts(min, max) {
  const first = getRandomInt(min, max);
  let second;
  do {
    second = getRandomInt(min, max);
  } while (first === second);

  return [first, second];
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const log = console.log;
