import React, { useState, useCallback, useRef, useEffect, DragEvent } from 'react';
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
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: fileService.uploadFile,
    onSuccess: (data) => {
      if (data.duplicate_detected) {
        setIsDuplicateDetected(true);
      } else {
        setIsDuplicateDetected(false);
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['fileStats'] });

      onUploadSuccess();
    },
    onError: (error) => {
      console.error('Upload error:', error);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setIsDuplicateDetected(false);
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    setShowDropIndicator(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
    setShowDropIndicator(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setShowDropIndicator(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
      setIsDuplicateDetected(false);
    }
  }, []);

  const handleUpload = async () => {
    if (selectedFile) {
      try {
        await uploadMutation.mutateAsync(selectedFile);
      } catch (error) {
        console.error('Upload error:', error);
      }
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <Container>
      <SpaceBetween size="l">
        <form>
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
              />
              <Box
                padding="xl"
                textAlign="center"
                className={isDragging ? "dragging-box" : "default-box"}
              >
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{ height: '100%', width: '100%' }}
                >
                  <SpaceBetween size="xs">
                    <div>
                      Drag and drop here or{' '}
                      <Button onClick={handleSelectFile} variant="link">
                        select a file
                      </Button>
                    </div>
                  </SpaceBetween>
                </div>
              </Box>

              {/* StatusIndicator rendered conditionally and outside layout-sensitive sections */}
              {showDropIndicator && (
                <Box>
                  <StatusIndicator type="info">Drop to upload</StatusIndicator>
                </Box>
              )}

              {selectedFile && (
                <Alert type="info">
                  Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </Alert>
              )}

              <Button
                disabled={!selectedFile}
                onClick={handleUpload}
                loading={uploadMutation.isPending}
                variant="primary"
              >
                Upload
              </Button>

              {uploadMutation.isSuccess && !isDuplicateDetected && (
                <Alert type="success">
                  File uploaded successfully!
                </Alert>
              )}

              {isDuplicateDetected && (
                <Alert
                  type="warning"
                  header="Duplicate file detected"
                  dismissible
                  onDismiss={() => setIsDuplicateDetected(false)}
                >
                  This file already exists in the system. A duplicate record has been created that references the existing file to save storage space.
                </Alert>
              )}

              {uploadMutation.isError && (
                <Alert type="error">
                  Error uploading file: {(uploadMutation.error as Error).message}
                </Alert>
              )}
            </SpaceBetween>
          </FormField>
        </form>
      </SpaceBetween>
    </Container>
  );
};