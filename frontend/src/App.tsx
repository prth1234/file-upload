import React, { useState } from 'react';
import {
  AppLayout,
  ContentLayout,
  Header,
  SpaceBetween,
  Container,
  Tabs,
  Badge,
  BreadcrumbGroup
} from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { FileStats } from './components/FileStats';
import { SearchPanel } from './components/SearchPanel';
import { FileFilters } from './services/fileService';
import './styles.css';
function App() {
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [activeTabId, setActiveTabId] = useState<string>('files');
  const [searchFilters, setSearchFilters] = useState<FileFilters>({
    searchQuery: '',
    fileTypes: [],
    minSize: null,
    maxSize: null,
    startDate: null,
    endDate: null
  });

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSearch = (filters: FileFilters) => {
    setSearchFilters(filters);
  };

  const navigationItems = [
    { text: 'Home', href: '#' },
    { text: 'File Vault', href: '#' }
  ];

  return (
    <AppLayout
      content={
        <ContentLayout
          header={
            <SpaceBetween size="m">
              <Header
                variant="h1"
                description="Secure file management with deduplication"
                actions={
                  <SpaceBetween direction="horizontal" size="xs">
                    <Badge color="blue">beta</Badge>
                  </SpaceBetween>
                }
              >
                Abnormal File Vault
              </Header>
              <BreadcrumbGroup items={navigationItems} />
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Container>
              <FileStats />
            </Container>
            
            <Container>
              <Tabs
                activeTabId={activeTabId}
                onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
                tabs={[
                  {
                    id: 'files',
                    label: 'Files',
                    content: (
                      <SpaceBetween size="l">
                        <SearchPanel onSearch={handleSearch} />
                        <FileList key={refreshKey} filters={searchFilters} />
                      </SpaceBetween>
                    )
                  },
                  {
                    id: 'upload',
                    label: 'Upload',
                    content: <FileUpload onUploadSuccess={handleUploadSuccess} />
                  }
                ]}
              />
            </Container>
          </SpaceBetween>
        </ContentLayout>
      }
      navigationHide={true}
      toolsHide={true}
    />
  );
}

export default App;