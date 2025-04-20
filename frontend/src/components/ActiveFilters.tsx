import React from 'react';
import { SpaceBetween, Button, Box } from '@cloudscape-design/components';
import { FileFilters } from '../services/fileService';

interface ActiveFiltersProps {
  filters: FileFilters;
  onRemoveFilter: (filterKey: keyof FileFilters, value: any) => void;
}

export const ActiveFilters: React.FC<ActiveFiltersProps> = ({ filters, onRemoveFilter }) => {
  const formatFilterValue = (key: keyof FileFilters, value: any): string => {
    switch (key) {
      case 'minSize':
        return `Min Size: ${Math.round(Number(value) / 1024)} KB`;
      case 'maxSize':
        return `Max Size: ${Math.round(Number(value) / 1024)} KB`;
      case 'startDate':
        return `From: ${new Date(value).toLocaleDateString()}`;
      case 'endDate':
        return `To: ${new Date(value).toLocaleDateString()}`;
      case 'fileTypes':
        return `Type: ${value[0]}`;
      case 'searchQuery':
        return `Search: ${value}`;
      default:
        return String(value);
    }
  };

  const getFilterLabel = (key: keyof FileFilters): string => {
    switch (key) {
      case 'minSize':
        return 'Minimum Size';
      case 'maxSize':
        return 'Maximum Size';
      case 'startDate':
        return 'Start Date';
      case 'endDate':
        return 'End Date';
      case 'fileTypes':
        return 'File Type';
      case 'searchQuery':
        return 'Search';
      default:
        return key;
    }
  };

  const renderFilterChip = (key: keyof FileFilters, value: any) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;

    return (
      <Button
        key={key}
        iconName="close"
        onClick={() => onRemoveFilter(key, value)}
        variant="link"
        ariaLabel={`Remove ${getFilterLabel(key)} filter`}
      >
        {formatFilterValue(key, value)}
      </Button>
    );
  };

  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === 'unique_only') return false; // Exclude unique_only from chips
    return value !== null && value !== undefined && value !== '';
  });

  if (activeFilters.length === 0) return null;

  return (
    <Box margin={{ top: 'm' }}>
      <SpaceBetween direction="horizontal" size="xs">
        {activeFilters.map(([key, value]) => renderFilterChip(key as keyof FileFilters, value))}
      </SpaceBetween>
    </Box>
  );
}; 