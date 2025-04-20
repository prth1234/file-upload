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
  const queryClient = useQueryClient();
  
  const uploadMutation = useMutation({
    mutationFn: fileService.uploadFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['fileStats'] });
      setSelectedFile(null);
      onUploadSuccess();
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
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
                      Drag and drop here or 
                      <Button onClick={handleSelectFile} variant="link">
                        select a file
                      </Button>
                    </div>
                    {isDragging && <StatusIndicator type="info">Drop to upload</StatusIndicator>}
                  </SpaceBetween>
                </div>
              </Box>
              
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
              
              {uploadMutation.isSuccess && (
                <Alert type="success">
                  File uploaded successfully!
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