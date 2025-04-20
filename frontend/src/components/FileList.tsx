import React, { useState, useEffect } from 'react';
import {
  Table,
  Box,
  SpaceBetween,
  Button,
  StatusIndicator,
  Pagination,
  TextFilter,
  Header,
  Toggle,
  Modal
} from '@cloudscape-design/components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService, FileItem, FileFilters } from '../services/fileService';
import { TbDatabaseSearch } from "react-icons/tb";

interface FileListProps {
  filters: FileFilters;
  onFiltersChange?: (newFilters: FileFilters) => void;
}

export const FileList: React.FC<FileListProps> = ({ filters, onFiltersChange }) => {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedItems, setSelectedItems] = useState<FileItem[]>([]);
  const [showUniqueOnly, setShowUniqueOnly] = useState<boolean>(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState<boolean>(false);
  const [selectedOriginalFile, setSelectedOriginalFile] = useState<string | null>(null);
  const pageSize = 10;

  const updatedFilters = {
    ...filters,
    unique_only: showUniqueOnly
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['files', updatedFilters],
    queryFn: () => fileService.getFiles(updatedFilters),
  });

  // Query for duplicates of a specific file
  const { 
    data: duplicatesData, 
    isLoading: duplicatesLoading,
    error: duplicatesError,
    refetch: refetchDuplicates
  } = useQuery({
    queryKey: ['fileDuplicates', selectedOriginalFile],
    queryFn: () => selectedOriginalFile ? fileService.getFileDuplicates(selectedOriginalFile) : null,
    enabled: !!selectedOriginalFile, // Only run when we have a selected file
  });

  const deleteMutation = useMutation({
    mutationFn: fileService.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['fileStats'] });
      if (selectedOriginalFile) {
        queryClient.invalidateQueries({ queryKey: ['fileDuplicates', selectedOriginalFile] });
      }
      setSelectedItems([]);
    },
  });

  const downloadMutation = useMutation({
    mutationFn: ({ fileUrl, filename }: { fileUrl: string, filename: string }) => 
      fileService.downloadFile(fileUrl, filename),
  });

  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(updatedFilters);
    }
  }, [showUniqueOnly]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDownload = async (fileUrl: string, filename: string) => {
    try {
      await downloadMutation.mutateAsync({ fileUrl, filename });
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      for (const item of selectedItems) {
        await deleteMutation.mutateAsync(item.id);
      }
    } catch (err) {
      console.error('Delete selected error:', err);
    }
  };

  const handleViewDuplicates = (fileId: string) => {
    setSelectedOriginalFile(fileId);
    setShowDuplicatesModal(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tableItems = data || [];
  const totalPages = Math.ceil(tableItems.length / pageSize);
  const paginatedItems = tableItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <SpaceBetween direction="vertical" size="m">
        <Box float="right">
          <Toggle
            onChange={({ detail }) => setShowUniqueOnly(detail.checked)}
            checked={showUniqueOnly}
          >
            Show unique files only
          </Toggle>
        </Box>
        
        <Table
          loading={isLoading}
          loadingText="Loading files"
          columnDefinitions={[
            {
              id: 'filename',
              header: 'File Name',
              cell: (item: FileItem) => (
                <div
                  title={item.original_filename}
                  style={{
                    maxWidth: '200px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.original_filename}
                </div>
              ),
              sortingField: 'original_filename',
            },
            {
              id: 'version',
              header: 'Version',
              cell: (item: FileItem) => `v${item.version || 1}`,
              sortingField: 'version'
            },
            {
              id: 'type',
              header: 'Type',
              cell: (item: FileItem) => (
                <div
                  title={item.file_type}
                  style={{
                    maxWidth: '200px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.file_type}
                </div>
              ),
              sortingField: 'file_type'
            },
            {
              id: 'size',
              header: 'Size',
              cell: (item: FileItem) => formatFileSize(item.size),
              sortingField: 'size'
            },
            {
              id: 'uploaded',
              header: 'Upload Date',
              cell: (item: FileItem) => new Date(item.uploaded_at).toLocaleString(),
              sortingField: 'uploaded_at'
            },
            {
              id: 'status',
              header: 'Status',
              cell: (item: FileItem) => 
                item.is_duplicate ? 
                  <StatusIndicator type="warning">Duplicate</StatusIndicator> : 
                  <StatusIndicator type="success">Original</StatusIndicator>
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: (item: FileItem) => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    onClick={() => handleDownload(item.file, item.original_filename)}
                    loading={downloadMutation.isPending}
                    iconName="download"
                    variant="icon"
                    ariaLabel="Download"
                  />
                  <Button
                    onClick={() => handleDelete(item.id)}
                    loading={deleteMutation.isPending}
                    iconName="remove"
                    variant="icon"
                    ariaLabel="Delete"
                    data-testid="delete-button"
                  />
                  {/* Fixed the icon component issue */}
                  {!item.is_duplicate && (
                    <Button
                      onClick={() => handleViewDuplicates(item.id)}
                      variant="icon"
                      iconName="search"
                      ariaLabel="View duplicates"
                    />
                  )}
                </SpaceBetween>
              )
            }
          ]}
          items={paginatedItems}
          selectionType="multi"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          pagination={
            <Pagination
              currentPageIndex={currentPage}
              onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
              pagesCount={totalPages}
              ariaLabels={{
                nextPageLabel: 'Next page',
                previousPageLabel: 'Previous page',
                pageLabel: pageNumber => `Page ${pageNumber} of all pages`
              }}
            />
          }
          header={
            <Header
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={selectedItems.length === 0}
                    onClick={handleDeleteSelected}
                    variant="primary"
                    iconName="remove"
                  >
                    Delete selected
                  </Button>
                </SpaceBetween>
              }
              counter={
                tableItems.length
                ? `(${tableItems.length})`
                : undefined
              }
            >
              Files History
            </Header>
          }
          empty={
            <Box textAlign="center" color="inherit">
              <b>No files</b>
              <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                No files to display.
              </Box>
            </Box>
          }
        />
      </SpaceBetween>

      {/* Modal for displaying duplicate files */}
      <Modal
        visible={showDuplicatesModal}
        onDismiss={() => {
          setShowDuplicatesModal(false);
          setSelectedOriginalFile(null);
        }}
        header="All duplicates"
        size="large"
      >
        <Box>
          {duplicatesLoading ? (
            <Box textAlign="center" padding="l">
              <StatusIndicator type="loading">Loading duplicates...</StatusIndicator>
            </Box>
          ) : duplicatesError ? (
            <Box textAlign="center" color="text-status-error" padding="l">
              <StatusIndicator type="error">
                Error loading duplicates. Please try again.
              </StatusIndicator>
            </Box>
          ) : duplicatesData ? (
            <SpaceBetween size="l">
              {/* Original file information */}
              <Box variant="h4">
                Original File: {duplicatesData.original_file?.original_filename}
              </Box>
              <Box variant="p">
                Found {duplicatesData.duplicate_count} duplicate entries of this file.
              </Box>

              {/* List of duplicates */}
              <Table
                columnDefinitions={[
                  {
                    id: 'filename',
                    header: 'File Name',
                    cell: (item: FileItem) => item.original_filename,
                  },
                  {
                    id: 'version',
                    header: 'Version',
                    cell: (item: FileItem) => `v${item.version || 1}`,
                  },
                  {
                    id: 'uploaded',
                    header: 'Upload Date',
                    cell: (item: FileItem) => new Date(item.uploaded_at).toLocaleString(),
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    cell: (item: FileItem) => (
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          onClick={() => handleDownload(item.file, item.original_filename)}
                          iconName="download"
                          variant="icon"
                          ariaLabel="Download"
                        />
                        <Button
                          onClick={() => {
                            handleDelete(item.id);
                            if (duplicatesData.duplicates.length === 1) {
                              setShowDuplicatesModal(false);
                            } else {
                              // Refetch after deletion
                              refetchDuplicates();
                            }
                          }}
                          iconName="remove"
                          variant="icon"
                          ariaLabel="Delete"
                        />
                      </SpaceBetween>
                    )
                  }
                ]}
                items={duplicatesData.duplicates || []}
                header={<Header>Duplicate Files</Header>}
                empty={
                  <Box textAlign="center" color="inherit" padding="l">
                    <b>No duplicates found</b>
                    <Box variant="p" color="inherit">
                      This file has no duplicates.
                    </Box>
                  </Box>
                }
              />
            </SpaceBetween>
          ) : (
            <Box textAlign="center" padding="l">
              No duplicate information available.
            </Box>
          )}
        </Box>
      </Modal>
    </>
  );
};