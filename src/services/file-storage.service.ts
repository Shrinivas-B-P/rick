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
      
      // Create subdirectories for different file types
      const subdirs = ['excel', 'attachments', 'temp'];
      subdirs.forEach(dir => {
        const dirPath = path.join(this.storagePath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      });
    }
  }
  
  /**
   * Store a file in the storage system
   * @param sourceFilePath Path to the source file
   * @param fileType Type of file (excel, attachment, etc.)
   * @param metadata Additional metadata for the file
   * @returns File information including ID and URL
   */
  async storeFile(sourceFilePath: string, fileType: string, metadata: any = {}): Promise<{
    fileId: string;
    fileName: string;
    filePath: string;
    downloadUrl: string;
    storedAt: Date;
  }> {
    try {
      if (this.storageType === 'local') {
        // Generate a unique file ID
        const fileId = uuidv4();
        const fileExt = path.extname(sourceFilePath);
        const originalFileName = path.basename(sourceFilePath);
        const fileName = metadata.fileName || `${fileId}${fileExt}`;
        
        // Determine destination path
        const destDir = path.join(this.storagePath, fileType);
        const destPath = path.join(destDir, fileName);
        
        // Copy the file to storage
        fs.copyFileSync(sourceFilePath, destPath);
        
        // Generate download URL (in a real app, this would be a proper URL)
        const downloadUrl = `/api/files/${fileType}/${fileName}`;
        
        return {
          fileId,
          fileName,
          filePath: destPath,
          downloadUrl,
          storedAt: new Date()
        };
      } else if (this.storageType === 's3') {
        // Implement S3 storage here
        throw new AppError(501, 'S3 storage not implemented yet');
      } else {
        throw new AppError(400, 'Unsupported storage type');
      }
    } catch (error) {
      console.error('Error storing file:', error);
      throw new AppError(500, 'Failed to store file');
    }
  }
  
  /**
   * Delete a file from storage
   * @param fileId File ID or name
   * @param fileType Type of file (excel, attachment, etc.)
   */
  async deleteFile(fileId: string, fileType: string): Promise<void> {
    try {
      if (this.storageType === 'local') {
        const filePath = path.join(this.storagePath, fileType, fileId);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (this.storageType === 's3') {
        // Implement S3 deletion here
        throw new AppError(501, 'S3 deletion not implemented yet');
      } else {
        throw new AppError(400, 'Unsupported storage type');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get the storage directory for a specific category
   * @param category The category (e.g., 'excel', 'attachment')
   * @returns The path to the storage directory
   */
  private getStorageDirectory(category: string): string {
    const dirPath = path.join(this.storagePath, category);
    
    // Ensure the directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    return dirPath;
  }

  /**
   * Get the path to a stored file
   * @param fileName File name
   * @param category File category (excel, attachments, etc.)
   * @returns Path to the file
   */
  getFilePath(fileName: string, category: string): string {
    // Construct the path to the file
    const filePath = path.join(this.getStorageDirectory(category), fileName);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${fileName} not found in ${category} storage`);
    }
    
    return filePath;
  }
} 