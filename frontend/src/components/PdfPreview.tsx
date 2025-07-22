import React from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface PdfPreviewProps {
  url: string;
  width?: string | number;
  height?: string | number;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({
  url,
  width = '100%',
  height = '600px'
}) => (
  <div style={{ width, height, borderRadius: 8, overflow: 'hidden' }}>
    <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}>
      <Viewer fileUrl={url} />
    </Worker>
  </div>
);