// API Configuration - Direct connection without proxy
export const API_CONFIG = {
  BASE_URL: 'http://localhost:9191/apireport',
  ENDPOINTS: {
    DOWNLOAD: '/report-download'
  },
  TIMEOUT: 3600000, // 60 minutes for very large files (up to 1GB+)
  MAX_RETRIES: 3,
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for streaming
  // Additional configurations for large file downloads
  MAX_CONTENT_LENGTH: Infinity,
  MAX_BODY_LENGTH: Infinity
}

// Utility functions untuk API
export const createDownloadRequest = (requestId, type, part) => ({
  "request-id": requestId,
  "type": type,
  "part": part
})

// Headers untuk request
export const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Accept': 'application/octet-stream, application/zip, text/csv, */*',
  'Authorization': `Bearer 1aa15090-2658-48e9-a1c8-df5a9185e7f2` // Ganti dengan token yang sesuai
})
