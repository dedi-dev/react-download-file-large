import { useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { API_CONFIG, createDownloadRequest, getHeaders } from '../utils/api'

const FileDownloader = () => {
  const [downloadRequest, setDownloadRequest] = useState({
    requestId: '',
    type: 'summary',
    part: 1,
    fileName: ''
  })
  
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadInfo, setDownloadInfo] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const cancelTokenRef = useRef(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setDownloadRequest(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileExtensionFromContentType = (contentType) => {
    const mimeToExtension = {
      'text/csv': '.csv',
      'application/json': '.json',
      'text/plain': '.txt',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
      'application/x-zip-compressed': '.zip',
      'application/x-zip': '.zip',
      'multipart/x-zip': '.zip',
      'text/html': '.html',
      'application/xml': '.xml',
      'text/xml': '.xml',
      'application/octet-stream': '' // Don't add extension for generic binary
    }
    return mimeToExtension[contentType] || ''
  }

  const ensureCorrectFileExtension = (fileName, contentType) => {
    const expectedExtension = getFileExtensionFromContentType(contentType)
    if (expectedExtension && !fileName.toLowerCase().endsWith(expectedExtension.toLowerCase())) {
      return fileName + expectedExtension
    }
    return fileName
  }

  const saveStreamCSV = (fileName, responseData) => {
    console.log('📄 Saving CSV file:', fileName)
    
    let blobObject
    
    // Handle different response types
    if (responseData instanceof Blob) {
      // If response is already a blob, use it directly
      blobObject = responseData
      console.log('📄 Using blob response directly')
    } else if (responseData instanceof ArrayBuffer) {
      // If response is ArrayBuffer, convert to blob
      blobObject = new Blob([responseData], { type: 'text/csv' })
      console.log('📄 Converted ArrayBuffer to blob')
    } else if (typeof responseData === 'string') {
      // If response is string, convert to blob
      blobObject = new Blob([responseData], { type: 'text/csv' })
      console.log('📄 Converted string to blob, length:', responseData.length)
    } else {
      // Fallback: try to convert to string first
      const dataStr = String(responseData)
      blobObject = new Blob([dataStr], { type: 'text/csv' })
      console.log('📄 Fallback: converted to string then blob')
    }
    
    // IE 10 and later, and Edge
    if (window.navigator.msSaveBlob) {
      window.navigator.msSaveBlob(blobObject, fileName)
      console.log('✅ CSV file saved successfully (IE/Edge)')
      return blobObject
    } else {
      // Modern browsers - use URL.createObjectURL for better memory efficiency
      const anchor = document.createElement('a')
      anchor.download = fileName
      anchor.href = window.URL.createObjectURL(blobObject)
      
      // Add to DOM temporarily for reliable clicking
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      
      // Clean up object URL to free memory
      window.URL.revokeObjectURL(anchor.href)
      console.log('✅ CSV file saved successfully, size:', blobObject.size)
      return blobObject
    }
  }

  const validateZipData = (data) => {
    // Check if data starts with ZIP file signature
    if (data instanceof Blob) {
      // For blob, we'll validate after arrayBuffer conversion
      return true
    } else if (data instanceof ArrayBuffer) {
      const view = new Uint8Array(data, 0, 4)
      // ZIP file signatures: PK\x03\x04 (local file header) or PK\x05\x06 (end of central directory)
      return (view[0] === 0x50 && view[1] === 0x4B && (view[2] === 0x03 || view[2] === 0x05))
    } else if (typeof data === 'string') {
      // For base64 string, decode first few bytes to check signature
      try {
        const decoded = atob(data.substring(0, 8)) // First 8 base64 chars = 6 bytes
        return decoded.charCodeAt(0) === 0x50 && decoded.charCodeAt(1) === 0x4B
      } catch (e) {
        return false
      }
    }
    return false
  }

  const saveStreamZIP = async (fileName, responseData) => {
    console.log('📦 Saving ZIP file:', fileName)
    
    let blobObject
    
    try {
      // Handle different response types efficiently
      if (responseData instanceof Blob) {
        // Check if blob contains base64 text data instead of binary
        const text = await responseData.text()
        console.log('📦 Blob content preview:', text.substring(0, 100))
        
        // Check if blob content is base64 (common issue with Spring Boot)
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
        if (base64Regex.test(text.replace(/[\r\n\s]/g, '').substring(0, 100))) {
          console.log('📦 Blob contains base64 data, converting...')
          
          // Clean and decode base64
          const cleanBase64 = text.replace(/[\r\n\s]/g, '')
          const binaryString = atob(cleanBase64)
          const bytes = new Uint8Array(binaryString.length)
          
          // Process in chunks to avoid memory issues
          const chunkSize = 1024 * 1024 // 1MB chunks
          for (let offset = 0; offset < binaryString.length; offset += chunkSize) {
            const chunk = binaryString.slice(offset, offset + chunkSize)
            for (let i = 0; i < chunk.length; i++) {
              bytes[offset + i] = chunk.charCodeAt(i)
            }
          }
          
          blobObject = new Blob([bytes], { type: 'application/zip' })
          console.log('📦 Converted base64 blob to binary blob, size:', blobObject.size)
        } else {
          // Blob already contains binary data
          blobObject = responseData
          console.log('📦 Using binary blob directly, size:', blobObject.size)
        }
        
        // Validate final ZIP data
        const buffer = await blobObject.arrayBuffer()
        const isValid = validateZipData(buffer)
        console.log('📦 ZIP validation result:', isValid ? 'VALID' : 'INVALID')
        if (!isValid) {
          console.warn('⚠️ ZIP file may be corrupted - invalid signature')
        }
        
      } else if (responseData instanceof ArrayBuffer) {
        // Validate ArrayBuffer first
        const isValid = validateZipData(responseData)
        console.log('📦 ZIP validation result:', isValid ? 'VALID' : 'INVALID')
        
        if (!isValid) {
          console.warn('⚠️ ZIP data appears to be corrupted - invalid signature')
        }
        
        blobObject = new Blob([responseData], { type: 'application/zip' })
        console.log('📦 Converted ArrayBuffer to blob, size:', blobObject.size)
        
      } else if (typeof responseData === 'string') {
        console.log('📦 Processing base64 string, length:', responseData.length)
        
        // Clean the base64 string first (remove any whitespace/newlines)
        const cleanBase64 = responseData.replace(/[\r\n\s]/g, '')
        console.log('📦 Cleaned base64 length:', cleanBase64.length)
        
        // Validate base64 format
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
        if (!base64Regex.test(cleanBase64)) {
          throw new Error('Invalid base64 format in ZIP data')
        }
        
        // Use more memory-efficient base64 decoding for large files
        const binaryString = atob(cleanBase64)
        const bytes = new Uint8Array(binaryString.length)
        
        // Process in chunks to avoid memory issues
        const chunkSize = 1024 * 1024 // 1MB chunks
        for (let offset = 0; offset < binaryString.length; offset += chunkSize) {
          const chunk = binaryString.slice(offset, offset + chunkSize)
          for (let i = 0; i < chunk.length; i++) {
            bytes[offset + i] = chunk.charCodeAt(i)
          }
        }
        
        blobObject = new Blob([bytes], { type: 'application/zip' })
        console.log('📦 Converted base64 to blob efficiently, size:', blobObject.size)
        
        // Final validation of converted data
        const finalBuffer = await blobObject.arrayBuffer()
        const finalValid = validateZipData(finalBuffer)
        console.log('📦 Final ZIP validation:', finalValid ? 'VALID' : 'INVALID')
        if (!finalValid) {
          console.error('❌ Final ZIP validation failed - file may be corrupted')
        }
        
      } else {
        throw new Error('Unsupported response data type for ZIP file')
      }

      // IE 10 and later, and Edge
      if (window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(blobObject, fileName)
        console.log('✅ ZIP file saved successfully (IE/Edge)')
      } else {
        // Modern browsers - use URL.createObjectURL for better memory efficiency
        const anchor = document.createElement('a')
        anchor.download = fileName
        anchor.href = window.URL.createObjectURL(blobObject)
        
        // Add to DOM temporarily for reliable clicking
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        
        // Clean up object URL to free memory immediately
        window.URL.revokeObjectURL(anchor.href)
        console.log('✅ ZIP file saved successfully, size:', blobObject.size)
      }
      
      return blobObject
      
    } catch (error) {
      console.error('❌ Error saving ZIP file:', error)
      throw new Error('Gagal menyimpan file ZIP: ' + error.message)
    }
  }

  const cancelDownload = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('Download cancelled by user')
    }
  }, [])

  const downloadFile = async () => {
    if (!downloadRequest.requestId || !downloadRequest.fileName) {
      setError('Request ID dan File Name harus diisi')
      return
    }

    if (!downloadRequest.part || downloadRequest.part < 1) {
      setError('Part harus berisi angka yang valid (minimal 1)')
      return
    }

    setDownloading(true)
    setError('')
    setSuccess('')
    setProgress(0)
    setDownloadInfo(null)

    // Create cancel token
    cancelTokenRef.current = axios.CancelToken.source()

    try {
      // Prepare request body dengan format baru
      const requestBody = createDownloadRequest(
        downloadRequest.requestId,
        downloadRequest.type,
        parseInt(downloadRequest.part)
      )

      // Prepare headers
      const headers = getHeaders()

      console.log('📤 Making request with:')
      console.log('📤 URL:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD}`)
      console.log('📤 Request body:', requestBody)
      console.log('📤 Headers:', headers)

      setDownloadInfo({
        fileName: downloadRequest.fileName,
        type: downloadRequest.type,
        part: downloadRequest.part,
        requestId: downloadRequest.requestId,
        status: 'Memulai download...'
      })

      // Make request to your Spring Boot API directly
      const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD}`, requestBody, {
        headers,
        responseType: 'blob', // Use blob for better memory efficiency with large files
        cancelToken: cancelTokenRef.current.token,
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setProgress(percentCompleted)
            setDownloadInfo(prev => ({
              ...prev,
              status: `Downloading... ${percentCompleted}%`,
              loaded: progressEvent.loaded,
              total: progressEvent.total
            }))
          } else {
            // Jika tidak ada total, hanya tampilkan bytes yang sudah di-load
            setDownloadInfo(prev => ({
              ...prev,
              status: `Downloading... ${formatFileSize(progressEvent.loaded)}`,
              loaded: progressEvent.loaded
            }))
          }
        },
        timeout: API_CONFIG.TIMEOUT,
        // Add additional configuration for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })

      console.log('📡 Request completed successfully')
      console.log('📡 Response status:', response.status)
      console.log('📡 Response statusText:', response.statusText)
      console.log('📡 Final URL used:', response.config.url)
      console.log('📡 Full response object:', response)
      console.log('📡 Response.data direct access:', response.data)
      console.log('📡 Response keys:', Object.keys(response))

      // Validasi response
      console.log('🔍 Validating response...')
      console.log('Response data exists:', !!response.data)
      console.log('Response data type:', typeof response.data)
      console.log('Response data instanceof Blob:', response.data instanceof Blob)
      
      if (!response.data) {
        throw new Error('Response data is empty')
      }

      // Gunakan content-type dari response header server
      const contentType = response.headers['content-type'] || response.headers['Content-Type'] || 'application/octet-stream'
      console.log('Content-Type yang digunakan:', contentType)
      
      // Tentukan nama file dengan extension yang sesuai
      const correctedFileName = ensureCorrectFileExtension(downloadRequest.fileName, contentType)
      console.log('File name yang akan digunakan:', correctedFileName)
      
      let blob
      
      // Handle berdasarkan content-type
      if (contentType.includes('text/csv')) {
        console.log('📄 Processing as CSV file')
        blob = saveStreamCSV(correctedFileName, response.data)
      } else if (contentType.includes('application/zip')) {
        console.log('📦 Processing as ZIP file')
        // For ZIP files, await the async processing
        blob = await saveStreamZIP(correctedFileName, response.data)
      } else {
        console.log('❓ Unknown content-type, treating as CSV')
        blob = saveStreamCSV(correctedFileName, response.data)
      }

      setSuccess(`File ${correctedFileName} berhasil didownload! (${formatFileSize(blob.size)})`)
      setDownloadInfo(prev => ({
        ...prev,
        status: 'Download selesai',
        completed: true,
        fileSize: blob.size,
        contentType: contentType,
        actualFileName: correctedFileName
      }))

    } catch (err) {
      console.error('Download error:', err)
      let errorMessage = 'Terjadi kesalahan saat download'
      
      if (axios.isCancel(err)) {
        errorMessage = 'Download dibatalkan'
      } else if (err.response) {
        // Server responded with error
        errorMessage = `Error ${err.response.status}: ${err.response.statusText}`
      } else if (err.request) {
        // Request was made but no response
        errorMessage = 'Tidak dapat terhubung ke server'
      } else if (err.code === 'ECONNABORTED') {
        // Timeout error
        errorMessage = 'Download timeout - file terlalu besar atau koneksi lambat'
      } else {
        errorMessage = err.message || 'Terjadi kesalahan tidak diketahui'
      }
      
      setError(errorMessage)
      setDownloadInfo(prev => prev ? {
        ...prev,
        status: 'Download gagal',
        error: true
      } : null)
    } finally {
      setDownloading(false)
      setProgress(0)
      cancelTokenRef.current = null
    }
  }

  const resetForm = () => {
    setDownloadRequest({
      requestId: '',
      type: 'summary',
      part: 1,
      fileName: ''
    })
    setProgress(0)
    setDownloadInfo(null)
    setError('')
    setSuccess('')
  }

  return (
    <div className="download-form">
      <h2>Download Report Part</h2>
      
      <div className="form-group">
        <label htmlFor="requestId">Request ID *</label>
        <input
          type="text"
          id="requestId"
          name="requestId"
          value={downloadRequest.requestId}
          onChange={handleInputChange}
          placeholder="Masukkan Request ID (contoh: 40896a5d-7b10-41b2-b751-e2ce601aed14)"
          disabled={downloading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="type">Type *</label>
        <select
          id="type"
          name="type"
          value={downloadRequest.type}
          onChange={handleInputChange}
          disabled={downloading}
        >
          <option value="summary">Summary</option>
          <option value="detail">Detail</option>
          <option value="report">Report</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="part">Part *</label>
        <input
          type="number"
          id="part"
          name="part"
          value={downloadRequest.part}
          onChange={handleInputChange}
          placeholder="Masukkan Part (contoh: 1)"
          min="1"
          disabled={downloading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="fileName">Nama File *</label>
        <input
          type="text"
          id="fileName"
          name="fileName"
          value={downloadRequest.fileName}
          onChange={handleInputChange}
          placeholder="contoh: report-summary atau report-detail"
          disabled={downloading}
        />
        <small style={{ color: '#888', fontSize: '0.9rem' }}>
          Extension file akan otomatis ditambahkan berdasarkan content-type dari server
        </small>
      </div>

      <div className="form-group">
        <button 
          className="btn btn-primary" 
          onClick={() => downloadFile()}
          disabled={downloading}
        >
          {downloading && <div className="loading-spinner"></div>}
          {downloading ? 'Downloading...' : 'Download File'}
        </button>
        
        {downloading && (
          <button 
            className="btn btn-secondary" 
            onClick={cancelDownload}
            style={{ marginLeft: '10px', background: '#dc3545' }}
          >
            Cancel
          </button>
        )}
        
        {!downloading && (
          <button 
            className="btn btn-secondary" 
            onClick={resetForm}
            style={{ marginLeft: '10px', background: '#666' }}
          >
            Reset
          </button>
        )}
      </div>

      {downloading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">
            {progress > 0 ? `${progress}% completed` : 'Preparing download...'}
          </div>
        </div>
      )}

      {downloadInfo && (
        <div className="download-info">
          <h3>Download Info</h3>
          <p><strong>Request ID:</strong> {downloadInfo.requestId}</p>
          <p><strong>Type:</strong> {downloadInfo.type.toUpperCase()}</p>
          <p><strong>Part:</strong> {downloadInfo.part}</p>
          <p><strong>File:</strong> {downloadInfo.fileName}</p>
          {downloadInfo.actualFileName && downloadInfo.actualFileName !== downloadInfo.fileName && (
            <p><strong>Actual File:</strong> {downloadInfo.actualFileName}</p>
          )}
          <p><strong>Status:</strong> {downloadInfo.status}</p>
          {downloadInfo.contentType && (
            <p><strong>Content-Type:</strong> {downloadInfo.contentType}</p>
          )}
          {downloadInfo.total && (
            <p><strong>Progress:</strong> {formatFileSize(downloadInfo.loaded)} / {formatFileSize(downloadInfo.total)}</p>
          )}
          {downloadInfo.loaded && !downloadInfo.total && (
            <p><strong>Downloaded:</strong> {formatFileSize(downloadInfo.loaded)}</p>
          )}
          {downloadInfo.fileSize && (
            <p><strong>Final Size:</strong> {formatFileSize(downloadInfo.fileSize)}</p>
          )}
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <strong>Success:</strong> {success}
        </div>
      )}
    </div>
  )
}

export default FileDownloader
