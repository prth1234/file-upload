import React, { useState, useCallback, useRef, DragEvent } from 'react';
import {
  Container,
  FormField,
  Button,
  SpaceBetween,
  Box,
  StatusIndicator,
  Alert
} from '@cloudscape-design/components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../services/fileService';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDuplicateDetected, setIsDuplicateDetected] = useState<boolean>(false);
  const [showDropIndicator, setShowDropIndicator] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  
  const queryClient = useQueryClient();
  
  const uploadMutation = useMutation({
    mutationFn: fileService.uploadFile,
    onMutate: () => {
      setIsUploading(true);
      // Reset any previous alerts
      setShowSuccessMessage(false);
      setIsDuplicateDetected(false);
    },
    onSuccess: (data) => {
      if (data.duplicate_detected) {
        setIsDuplicateDetected(true);
        setShowSuccessMessage(false); // Ensure success message is not shown for duplicates
      } else {
        setIsDuplicateDetected(false);
        setShowSuccessMessage(true); // Show success message only for non-duplicates
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 5000);
      }
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['fileStats'] });
      
      onUploadSuccess();
      
      // Auto-hide duplicate message after 5 seconds
      if (data.duplicate_detected) {
        setTimeout(() => {
          setIsDuplicateDetected(false);
        }, 5000);
      }
      
      setIsUploading(false);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsUploading(false);
      setShowSuccessMessage(false);
    }
  });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      // Reset alerts when a new file is selected
      setIsDuplicateDetected(false);
      setShowSuccessMessage(false);
    }
  };
  
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setShowDropIndicator(true);
  }, []);
  
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setShowDropIndicator(false);
  }, []);
  
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setShowDropIndicator(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      // Reset alerts when a new file is dropped
      setIsDuplicateDetected(false);
      setShowSuccessMessage(false);
    }
  }, []);
  
  const handleUpload = async () => {
    if (selectedFile && !isUploading) {
      try {
        setIsUploading(true);
        await uploadMutation.mutateAsync(selectedFile);
      } catch (error) {
        console.error('Upload error:', error);
        setIsUploading(false);
      }
    }
  };
  
  const handleSelectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handle duplicate alert dismissal
  const handleDuplicateAlertDismiss = () => {
    setIsDuplicateDetected(false);
    // Important: Do not show success message after dismissing duplicate alert
    setShowSuccessMessage(false);
  };
  
  const boxClassName = isDragging 
    ? "file-upload-box dragging" 
    : "file-upload-box";
  
  return (
    <Container>
      <SpaceBetween size="l">
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          if (!isUploading) {
            handleUpload(); 
          }
        }}>
          <FormField
            label="Upload file"
            description="Select or drag a file to upload"
          >
            <SpaceBetween size="xs">
              <input
                type="file"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="*/*"
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ width: '100%', cursor: 'pointer' }}
              >
                <Box
                  padding="xl"
                  textAlign="center"
                  className={boxClassName}
                >
                  <SpaceBetween size="xs">
                    <div>
                      Drag and drop here or{' '}
                      <Button 
                        onClick={() => handleSelectFile()} 
                        variant="link"
                      >
                        select a file
                      </Button>
                    </div>
                    {showDropIndicator && (
                      <StatusIndicator type="info">Drop to upload</StatusIndicator>
                    )}
                  </SpaceBetween>
                </Box>
              </div>
              {selectedFile && (
                <Alert type="info">
                  Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </Alert>
              )}
              <Button
                disabled={!selectedFile || isUploading || uploadMutation.isPending}
                onClick={() => handleUpload()}
                loading={isUploading || uploadMutation.isPending}
                variant="primary"
              >
                Upload
              </Button>
              
              {/* Only show success message when appropriate */}
              {showSuccessMessage && !isDuplicateDetected && (
                <Alert 
                  type="success"
                  dismissible
                  onDismiss={() => setShowSuccessMessage(false)}
                >
                  File uploaded successfully!
                </Alert>
              )}
              
              {/* Duplicate alert - don't show success message when this is visible */}
              {isDuplicateDetected && (
                <Alert
                  type="warning"
                  header="Duplicate file detected"
                  dismissible
                  onDismiss={handleDuplicateAlertDismiss}
                >
                  This file already exists in the system. A duplicate record has been created that references the existing file to save storage space.
                </Alert>
              )}
              
              {uploadMutation.isError && (
                <Alert
                  type="error"
                  dismissible
                  onDismiss={() => uploadMutation.reset()}
                >
                  Error uploading file: {(uploadMutation.error as Error)?.message || "Server error occurred"}
                </Alert>
              )}
            </SpaceBetween>
          </FormField>
        </form>
      </SpaceBetween>
    </Container>
  );
};