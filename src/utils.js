import { access, mkdir, readdir } from 'fs/promises';

export async function checkAndCreateDirectory(dirPath) {
  try {
    await access(dirPath);
  } catch (error) {
    await mkdir(dirPath);
  }
}

export async function countFilesInFolder(folderPath, prefix) {
  try {
    const files = await readdir(folderPath);
    const filteredFiles = (prefix !== undefined) ? files.filter(file => file.startsWith(prefix)) : files;
    return filteredFiles.length;
  } catch (err) {
    console.error('Error:', err);
    return 0;
  }
}
