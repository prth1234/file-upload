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

// Add some icons for better visuals
import { Upload, File, FileCheck, AlertCircle } from 'lucide-react';

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
      setShowSuccessMessage(false);
      setIsDuplicateDetected(false);
    },
    onSuccess: (data) => {
      if (data.duplicate_detected) {
        setIsDuplicateDetected(true);
        setShowSuccessMessage(false);
      } else {
        setIsDuplicateDetected(false);
        setShowSuccessMessage(true);
        
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
  
  const handleDuplicateAlertDismiss = () => {
    setIsDuplicateDetected(false);
    setShowSuccessMessage(false);
  };
  
  // Custom CSS styles as inline styles
  const dropZoneStyle: React.CSSProperties = {
    border: isDragging 
      ? '2px dashed #0972d3' // AWS Cloudscape primary blue when dragging
      : '2px dashed #adb5bd', // Lighter gray when not dragging
    borderRadius: '8px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDragging ? 'rgba(9, 114, 211, 0.05)' : '#f8f9fa',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    minHeight: '180px',
  };
  
  const iconStyle: React.CSSProperties = {
    marginBottom: '16px',
    color: isDragging ? '#0972d3' : '#495057'
  };
  
  const textStyle: React.CSSProperties = {
    color: '#495057',
    marginBottom: '8px'
  };
  
  const linkStyle: React.CSSProperties = {
    color: '#0972d3',
    fontWeight: 500,
    cursor: 'pointer',
    textDecoration: 'none'
  };
  
  const infoTextStyle: React.CSSProperties = {
    color: '#6c757d',
    fontSize: '14px'
  };
  
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
                style={{ width: '100%' }}
                onClick={handleSelectFile}
              >
                <div style={dropZoneStyle}>
                  {/* Show different icons based on state */}
                  {isDragging ? (
                    <FileCheck size={48} style={iconStyle} />
                  ) : (
                    <Upload size={48} style={iconStyle} />
                  )}
                  
                  <div style={textStyle}>
                    {isDragging ? (
                      <strong>Drop file here</strong>
                    ) : (
                      <>
                        <strong>Drag &amp; drop your file here</strong>
                      </>
                    )}
                  </div>
                  
                  {!isDragging && (
                    <div style={infoTextStyle}>
                      or <span style={linkStyle}>browse</span> to select a file
                    </div>
                  )}
                  
                  {showDropIndicator && isDragging && (
                    <StatusIndicator type="info">Ready to drop</StatusIndicator>
                  )}
                </div>
              </div>
              
              {selectedFile && (
                <Alert type="info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <File size={20} />
                    <span>
                      <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </span>
                  </div>
                </Alert>
              )}
              
              <Button
                disabled={!selectedFile || isUploading || uploadMutation.isPending}
                onClick={() => handleUpload()}
                loading={isUploading || uploadMutation.isPending}
                variant="primary"
                iconName="upload"
              >
                Upload file
              </Button>
              
              {showSuccessMessage && !isDuplicateDetected && (
                <Alert 
                  type="success"
                  dismissible
                  onDismiss={() => setShowSuccessMessage(false)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={20} />
                    <span>File uploaded successfully!</span>
                  </div>
                </Alert>
              )}
              
              {isDuplicateDetected && (
                <Alert
                  type="warning"
                  header="Duplicate file detected"
                  dismissible
                  onDismiss={handleDuplicateAlertDismiss}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={20} />
                    <span>
                      This file already exists in the system. A duplicate record has been 
                      created that references the existing file to save storage space.
                    </span>
                  </div>
                </Alert>
              )}
              
              {uploadMutation.isError && (
                <Alert
                  type="error"
                  dismissible
                  onDismiss={() => uploadMutation.reset()}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={20} />
                    <span>
                      Error uploading file: {(uploadMutation.error as Error)?.message || "Server error occurred"}
                    </span>
                  </div>
                </Alert>
              )}
            </SpaceBetween>
          </FormField>
        </form>
      </SpaceBetween>
    </Container>
  );
};