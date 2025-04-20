import React, { useState, useEffect, useCallback } from 'react';
import {
  FormField,
  Input,
  SpaceBetween,
  Grid,
  Box,
  Button,
  Select,
  DatePicker,
  Container,
  ExpandableSection,
} from '@cloudscape-design/components';
import { FileFilters } from '../services/fileService';
import { ActiveFilters } from './ActiveFilters';

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

const STORAGE_KEY = 'fileFilters';
const EXPANDED_STATE_KEY = 'advancedFiltersExpanded';

export const SearchPanel: React.FC<SearchPanelProps> = ({ onSearch, initialFilters }) => {
  // Initialize expanded state from localStorage
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const savedState = localStorage.getItem(EXPANDED_STATE_KEY);
    return savedState ? JSON.parse(savedState) : false;
  });

  // Save expanded state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(EXPANDED_STATE_KEY, JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Initialize state from localStorage or initialFilters
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      return parsed.searchQuery || initialFilters?.searchQuery || '';
    }
    return initialFilters?.searchQuery || '';
  });

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

  const [selectedFileType, setSelectedFileType] = useState<FileTypeOption | null>(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      if (parsed.fileTypes?.length) {
        const type = parsed.fileTypes[0];
        const option = fileTypeOptions.find(opt => opt.value === type || opt.value.endsWith(`/${type}`));
        return option || { label: type, value: type };
      }
    }
    if (initialFilters?.fileTypes?.length) {
      const type = initialFilters.fileTypes[0];
      const option = fileTypeOptions.find(opt => opt.value === type || opt.value.endsWith(`/${type}`));
      return option || { label: type, value: type };
    }
    return null;
  });

  const [minSize, setMinSize] = useState<string>(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      return parsed.minSize ? String(parsed.minSize / 1024) : '';
    }
    return initialFilters?.minSize ? String(initialFilters.minSize / 1024) : '';
  });

  const [maxSize, setMaxSize] = useState<string>(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      return parsed.maxSize ? String(parsed.maxSize / 1024) : '';
    }
    return initialFilters?.maxSize ? String(initialFilters.maxSize / 1024) : '';
  });

  const [startDate, setStartDate] = useState<DateValue | null>(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      return parsed.startDate ? { value: parsed.startDate } : null;
    }
    return initialFilters?.startDate ? { value: initialFilters.startDate } : null;
  });

  const [endDate, setEndDate] = useState<DateValue | null>(() => {
    const savedFilters = localStorage.getItem(STORAGE_KEY);
    if (savedFilters) {
      const parsed = JSON.parse(savedFilters);
      return parsed.endDate ? { value: parsed.endDate } : null;
    }
    return initialFilters?.endDate ? { value: initialFilters.endDate } : null;
  });

  const handleSearch = useCallback(() => {
    const filters: FileFilters = {
      searchQuery,
      fileTypes: selectedFileType ? [selectedFileType.value] : [],
      minSize: minSize ? parseInt(minSize) * 1024 : null,
      maxSize: maxSize ? parseInt(maxSize) * 1024 : null,
      startDate: startDate?.value || null,
      endDate: endDate?.value || null,
      unique_only: initialFilters?.unique_only || false
    };
    
    // Save filters to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    
    onSearch(filters);
  }, [searchQuery, selectedFileType, minSize, maxSize, startDate, endDate, onSearch, initialFilters?.unique_only]);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, selectedFileType, minSize, maxSize, startDate, endDate, handleSearch]);

  const handleRemoveFilter = (filterKey: keyof FileFilters, value: any) => {
    switch (filterKey) {
      case 'searchQuery':
        setSearchQuery('');
        break;
      case 'fileTypes':
        setSelectedFileType(null);
        break;
      case 'minSize':
        setMinSize('');
        break;
      case 'maxSize':
        setMaxSize('');
        break;
      case 'startDate':
        setStartDate(null);
        break;
      case 'endDate':
        setEndDate(null);
        break;
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedFileType(null);
    setMinSize('');
    setMaxSize('');
    setStartDate(null);
    setEndDate(null);

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);

    onSearch({
      searchQuery: '',
      fileTypes: [],
      minSize: null,
      maxSize: null,
      startDate: null,
      endDate: null,
      unique_only: initialFilters?.unique_only || false
    });
  };

  const currentFilters: FileFilters = {
    searchQuery,
    fileTypes: selectedFileType ? [selectedFileType.value] : [],
    minSize: minSize ? parseInt(minSize) * 1024 : null,
    maxSize: maxSize ? parseInt(maxSize) * 1024 : null,
    startDate: startDate?.value || null,
    endDate: endDate?.value || null,
    unique_only: initialFilters?.unique_only || false
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

        <ActiveFilters filters={currentFilters} onRemoveFilter={handleRemoveFilter} />

        <ExpandableSection 
          headerText="Advanced filters"
          expanded={isExpanded}
          onChange={({ detail }) => setIsExpanded(detail.expanded)}
        >
          <SpaceBetween size="l">
            <FormField label="File type">
              <Select
                selectedOption={selectedFileType}
                onChange={({ detail }) => {
                  if (detail.selectedOption.value === "" || 
                      (selectedFileType && detail.selectedOption.value === selectedFileType.value)) {
                    setSelectedFileType(null);
                  } else {
                    setSelectedFileType(detail.selectedOption as FileTypeOption);
                  }
                }}
                options={[
                  { 
                    label: "No selection",
                    value: "",
                    description: "Select a file type"
                  },
                  ...fileTypeOptions
                ]}
                placeholder="Select a file type"
                selectedAriaLabel="Selected"
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
