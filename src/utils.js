import { access, mkdir, readdir, readFile, writeFile } from 'fs/promises';
import sort from 'alphanum-sort';

export async function checkAndCreateDirectory(dirPath) {
  try {
    await access(dirPath);
  } catch (error) {
    await mkdir(dirPath);
  }
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
