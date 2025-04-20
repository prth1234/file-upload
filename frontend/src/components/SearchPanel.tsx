// SearchPanel.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  FormField,
  Input,
  SpaceBetween,
  Grid,
  Box,
  Button,
  Multiselect,
  DatePicker,
  Container,
  ExpandableSection
} from '@cloudscape-design/components';
import { FileFilters } from '../services/fileService';

interface SearchPanelProps {
  onSearch: (filters: FileFilters) => void;
}

interface FileTypeOption {
  label: string;
  value: string;
}

interface DateValue {
  value: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFileTypes, setSelectedFileTypes] = useState<FileTypeOption[]>([]);
  const [minSize, setMinSize] = useState<string>('');
  const [maxSize, setMaxSize] = useState<string>('');
  const [startDate, setStartDate] = useState<DateValue | null>(null);
  const [endDate, setEndDate] = useState<DateValue | null>(null);

  const fileTypeOptions: FileTypeOption[] = [
    { label: 'PDF Document', value: 'application/pdf' },
    { label: 'JPEG Image', value: 'image/jpeg' },
    { label: 'PNG Image', value: 'image/png' },
    { label: 'Word Document', value: 'application/msword' },
    { label: 'Excel Spreadsheet', value: 'application/vnd.ms-excel' },
    { label: 'Text File', value: 'text/plain' },
    { label: 'ZIP Archive', value: 'application/zip' },
    { label: 'MP3 Audio', value: 'audio/mpeg' },
    { label: 'MP4 Video', value: 'video/mp4' }
  ];

  const handleSearch = useCallback(() => {
    const filters: FileFilters = {
      searchQuery,
      fileTypes: selectedFileTypes.map(item => item.value),
      minSize: minSize ? parseInt(minSize) * 1024 : null, // Convert KB to bytes
      maxSize: maxSize ? parseInt(maxSize) * 1024 : null, // Convert KB to bytes
      startDate: startDate?.value || null,
      endDate: endDate?.value || null
    };
    
    onSearch(filters);
  }, [searchQuery, selectedFileTypes, minSize, maxSize, startDate, endDate, onSearch]);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, selectedFileTypes, minSize, maxSize, startDate, endDate, handleSearch]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedFileTypes([]);
    setMinSize('');
    setMaxSize('');
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <Container>
      <SpaceBetween size="l">
        <Grid gridDefinition={[{ colspan: 9 }, { colspan: 3 }]}>
          <FormField label="Search files">
            <Input
              value={searchQuery}
              onChange={({ detail }) => setSearchQuery(detail.value)}
              placeholder="Search by filename"
            />
          </FormField>
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={handleClearFilters}>Clear filters</Button>
            </SpaceBetween>
          </Box>
        </Grid>
        
        <ExpandableSection headerText="Advanced filters">
          <SpaceBetween size="l">
            <FormField label="File type">
              <Multiselect
                selectedOptions={selectedFileTypes}
                onChange={({ detail }) => setSelectedFileTypes(detail.selectedOptions as FileTypeOption[])}
                options={fileTypeOptions}
                placeholder="Select file types"
              />
            </FormField>
            
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <FormField label="Min size (KB)">
                <Input
                  value={minSize}
                  onChange={({ detail }) => setMinSize(detail.value)}
                  type="number"
                  placeholder="Minimum size"
                />
              </FormField>
              <FormField label="Max size (KB)">
                <Input
                  value={maxSize}
                  onChange={({ detail }) => setMaxSize(detail.value)}
                  type="number"
                  placeholder="Maximum size"
                />
              </FormField>
            </Grid>
            
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <FormField label="Start date">
                <DatePicker
                  value={startDate?.value || ''}
                  onChange={({ detail }) => setStartDate({ value: detail.value })}
                  placeholder="YYYY/MM/DD"
                />
              </FormField>
              <FormField label="End date">
                <DatePicker
                  value={endDate?.value || ''}
                  onChange={({ detail }) => setEndDate({ value: detail.value })}
                  placeholder="YYYY/MM/DD"
                />
              </FormField>
            </Grid>
          </SpaceBetween>
        </ExpandableSection>
      </SpaceBetween>
    </Container>
  );
};