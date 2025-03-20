import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/error';

// Define storage options - could be local filesystem, S3, etc.
type StorageType = 'local' | 's3';

export class FileStorageService {
  private storageType: StorageType;
  private storagePath: string;
  
  constructor(storageType: StorageType = 'local') {
    this.storageType = storageType;
    
    // Set up storage path based on environment
    if (process.env.NODE_ENV === 'production') {
      this.storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
    } else {
      this.storagePath = path.join(process.cwd(), 'storage');
    }
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
  }
  
  /**
   * Ensure the storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (this.storageType === 'local') {
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }
    }
  }
  
  /**
   * Store a file in the storage system
   * @param filePath Path to the file to store
   * @param category File category (excel, attachments, etc.)
   * @param customFileName Optional custom file name
   * @returns Stored file information
   */
  public storeFile(filePath: string, category: string, customFileName?: string): { fileName: string, path: string } {
    try {
      console.log(`Storing file from ${filePath} in category ${category}`);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        throw new AppError(404, 'File not found');
      }
      
      // Generate a unique file name if not provided
      const fileName = customFileName || `${uuidv4()}${path.extname(filePath)}`;
      
      // Get the directory path for this category
      const dirPath = this.getStorageDirectory(category);
      
      // Create the full path for the stored file
      const storedFilePath = path.join(dirPath, fileName);
      
      console.log(`Copying file to ${storedFilePath}`);
      
      // Copy the file to the storage location
      fs.copyFileSync(filePath, storedFilePath);
      
      return {
        fileName,
        path: storedFilePath
      };
    } catch (error) {
      console.error('Error storing file:', error);
      throw new AppError(500, 'Failed to store file');
    }
  }
  
  /**
   * Retrieve a file from storage
   * @param fileName File name
   * @param category File category
   * @returns Path to the file
   */
  public getFilePath(fileName: string, category: string): string {
    const filePath = path.join(this.getStorageDirectory(category), fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new AppError(404, `File ${fileName} not found in ${category} storage`);
    }
    
    return filePath;
  }
  
  /**
   * Get the storage directory for a category
   * @param category File category
   * @returns The path to the storage directory
   */
  private getStorageDirectory(category: string): string {
    const dirPath = path.join(this.storagePath, category);
    
    // Ensure the directory exists
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dirPath}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    return dirPath;
  }
} 