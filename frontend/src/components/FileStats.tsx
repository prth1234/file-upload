import React from 'react';
import {
  Box,
  Container,
  Cards,
  Header,
  StatusIndicator
} from '@cloudscape-design/components';
import { useQuery } from '@tanstack/react-query';
import { fileService, FileStats as FileStatsInterface } from '../services/fileService';

export const FileStats: React.FC = () => {
  const { data: stats, isLoading, error } = useQuery<FileStatsInterface>({
    queryKey: ['fileStats'],
    queryFn: () => fileService.getFileStats(),
  });

  if (isLoading) {
    return (
      <Container>
        <StatusIndicator type="loading">Loading statistics...</StatusIndicator>
      </Container>
    );
  }

  if (error || !stats) {
    return (
      <Container>
        <StatusIndicator type="error">Error loading statistics</StatusIndicator>
      </Container>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Cards
      cardDefinition={{
        header: item => item.header,
        sections: [
          {
            id: 'value',
            content: item => <Box fontSize="display-l" fontWeight="bold">{item.value}</Box>
          },
          {
            id: 'description',
            content: item => <Box color="text-body-secondary">{item.description}</Box>
          }
        ]
      }}
      cardsPerRow={[
        { cards: 1 },
        { minWidth: 400, cards: 2 },
        { minWidth: 800, cards: 4 }
      ]}
      items={[
        {
          header: 'Total Files',
          value: stats.total_files.toString(),
          description: 'Files stored in the system'
        },
        {
          header: 'Unique Files',
          value: stats.unique_files.toString(),
          description: 'Unique content files'
        },
        {
          header: 'Duplicates',
          value: stats.duplicate_files.toString(),
          description: 'Deduplicated file references'
        },
        {
          header: 'Storage Saved',
          value: formatFileSize(stats.storage_saved),
          description: `Efficiency: ${stats.storage_efficiency}`
        }
      ]}
      loading={isLoading}
      loadingText="Loading statistics"
      empty={
        <Box textAlign="center" color="inherit">
          <b>No statistics available</b>
        </Box>
      }
      header={<Header>System Statistics</Header>}
    />
  );
};