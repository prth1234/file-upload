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
  ExpandableSection,
  Toggle
} from '@cloudscape-design/components';
import { FileFilters } from '../services/fileService';

interface SearchPanelProps {
  onSearch: (filters: FileFilters) => void;
  initialFilters?: FileFilters;
}

interface FileTypeOption {
  label: string;
  value: string;
}

interface DateValue {
  value: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch, initialFilters }) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialFilters?.searchQuery || '');
  const [selectedFileTypes, setSelectedFileTypes] = useState<FileTypeOption[]>(() => {
    if (initialFilters?.fileTypes?.length) {
      return initialFilters.fileTypes.map(type => {
        const option = fileTypeOptions.find(opt => opt.value === type || opt.value.endsWith(`/${type}`));
        return option || { label: type, value: type };
      });
    }
    return [];
  });
  const [minSize, setMinSize] = useState<string>(initialFilters?.minSize ? String(initialFilters.minSize / 1024) : '');
  const [maxSize, setMaxSize] = useState<string>(initialFilters?.maxSize ? String(initialFilters.maxSize / 1024) : '');
  const [startDate, setStartDate] = useState<DateValue | null>(initialFilters?.startDate ? { value: initialFilters.startDate } : null);
  const [endDate, setEndDate] = useState<DateValue | null>(initialFilters?.endDate ? { value: initialFilters.endDate } : null);
  const [hardFilter, setHardFilter] = useState<boolean>(initialFilters?.hardFilter || false);

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

// In the handleSearch function
const handleSearch = useCallback(() => {
  const filters: FileFilters = {
    searchQuery,
    fileTypes: selectedFileTypes.map(item => {
      // When hard filter is true, we want exact matches only
      if (hardFilter) {
        return item.value; // Send the full MIME type for exact matching
      } else {
        // For non-hard filter, we're more flexible - extract the subtype
        // e.g., "application/pdf" → "pdf" or send the full thing if no "/" is found
        const parts = item.value.split('/');
        return parts.length > 1 ? parts[1] : item.value;
      }
    }),
    minSize: minSize ? parseInt(minSize) * 1024 : null, 
    maxSize: maxSize ? parseInt(maxSize) * 1024 : null, 
    startDate: startDate?.value || null,
    endDate: endDate?.value || null,
    hardFilter,
    unique_only: initialFilters?.unique_only || false
  };
  
  onSearch(filters);
}, [searchQuery, selectedFileTypes, minSize, maxSize, startDate, endDate, hardFilter, onSearch, initialFilters?.unique_only]);
  // Apply filters whenever they change
  useEffect(() => {
    handleSearch();
  }, [searchQuery, selectedFileTypes, minSize, maxSize, startDate, endDate, hardFilter, handleSearch]);

  // Update local state if initialFilters change
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.searchQuery !== undefined) setSearchQuery(initialFilters.searchQuery);
      if (initialFilters.minSize !== undefined && initialFilters.minSize !== null) 
        setMinSize(String(initialFilters.minSize / 1024));
      if (initialFilters.maxSize !== undefined && initialFilters.maxSize !== null) 
        setMaxSize(String(initialFilters.maxSize / 1024));
      if (initialFilters.startDate) setStartDate({ value: initialFilters.startDate });
      if (initialFilters.endDate) setEndDate({ value: initialFilters.endDate });
      if (initialFilters.hardFilter !== undefined) setHardFilter(initialFilters.hardFilter);
      
      if (initialFilters.fileTypes?.length) {
        const newSelectedTypes = initialFilters.fileTypes.map(type => {
          const option = fileTypeOptions.find(opt => opt.value === type || opt.value.endsWith(`/${type}`));
          return option || { label: type, value: type };
        });
        setSelectedFileTypes(newSelectedTypes);
      }
    }
  }, [initialFilters]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedFileTypes([]);
    setMinSize('');
    setMaxSize('');
    setStartDate(null);
    setEndDate(null);
    setHardFilter(false);
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
              <SpaceBetween direction="vertical" size="s">
                <Multiselect
                  selectedOptions={selectedFileTypes}
                  onChange={({ detail }) => setSelectedFileTypes(detail.selectedOptions as FileTypeOption[])}
                  options={fileTypeOptions}
                  placeholder="Select file types"
                />
                <Toggle
                  onChange={({ detail }) => setHardFilter(detail.checked)}
                  checked={hardFilter}
                >
                  Hard filter (exact match only)
                </Toggle>
              </SpaceBetween>
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