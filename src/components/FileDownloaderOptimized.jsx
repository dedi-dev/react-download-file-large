import { useState, useCallback, useRef } from 'react'
import axios from 'axios'
import { API_CONFIG, createDownloadRequest, getHeaders } from '../utils/api'
import { 
  streamingDownload, 
  decodeBase64Efficiently, 
  processZipInChunks, 
  validateZipSignature, 
  saveFileEfficiently,
  getMemoryInfo,
  forceGC
} from '../utils/streamingDownload'

const FileDownloaderOptimized = () => {
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
  const [processingStage, setProcessingStage] = useState('')
  const [memoryInfo, setMemoryInfo] = useState(null)
  const [useStreaming, setUseStreaming] = useState(true)
  const cancelTokenRef = useRef(null)
  const abortControllerRef = useRef(null)

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
      'application/octet-stream': ''
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

  const updateMemoryInfo = () => {
    const info = getMemoryInfo()
    if (info) {
      setMemoryInfo(info)
      console.log('💾 Memory Usage:', `${info.used}MB / ${info.total}MB (Limit: ${info.limit}MB)`)
      
      // Warning jika memory usage tinggi
      if (info.used / info.limit > 0.7) {
        console.warn('⚠️ High memory usage detected:', `${Math.round((info.used / info.limit) * 100)}%`)
      }
    }
  }

  const cleanupMemory = () => {
    // Force garbage collection jika available
    forceGC()
    
    // Clear any lingering references
    if (window.gc) {
      console.log('🗑️ Forcing garbage collection...')
      window.gc()
    }
    
    // Update memory info setelah cleanup
    setTimeout(() => {
      updateMemoryInfo()
    }, 100)
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
    
    // Clear reference to original responseData for garbage collection
    responseData = null
    
    saveFileEfficiently(blobObject, fileName, (progress) => {
      console.log('📄 Save progress:', progress)
    })
    
    console.log('📄 CSV file processing completed, memory should be freed')
    return blobObject
  }

  const saveStreamZIP = async (fileName, responseData) => {
    console.log('📦 Saving ZIP file:', fileName)
    
    let blobObject
    
    try {
      setProcessingStage('Processing ZIP data...')
      updateMemoryInfo()
      
      if (responseData instanceof Blob) {
        const text = await responseData.text()
        console.log('📦 Blob content preview:', text.substring(0, 100))
        
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
        if (base64Regex.test(text.replace(/[\r\n\s]/g, '').substring(0, 100))) {
          console.log('📦 Blob contains base64 data, converting efficiently...')
          setProcessingStage('Decoding base64 data...')
          
          const cleanBase64 = text.replace(/[\r\n\s]/g, '')
          blobObject = decodeBase64Efficiently(cleanBase64, (progress) => {
            setProgress(progress.percentage)
            setProcessingStage(`Decoding base64: ${progress.percentage}%`)
          })
          
          updateMemoryInfo()
          
        } else {
          console.log('📦 Using binary blob directly')
          blobObject = responseData
        }
        
        // Process ZIP in chunks untuk large files
        if (blobObject.size > 100 * 1024 * 1024) { // 100MB+
          setProcessingStage('Processing large ZIP file...')
          blobObject = await processZipInChunks(blobObject, (progress) => {
            setProgress(progress.percentage)
            setProcessingStage(`Processing ZIP: ${progress.percentage}%`)
          })
          updateMemoryInfo()
        }
        
        // Validate ZIP signature
        setProcessingStage('Validating ZIP file...')
        const isValid = await validateZipSignature(blobObject)
        if (!isValid) {
          console.warn('⚠️ ZIP file may be corrupted - invalid signature')
        }
        
      } else if (responseData instanceof ArrayBuffer) {
        const isValid = await validateZipSignature(new Blob([responseData]))
        if (!isValid) {
          console.warn('⚠️ ZIP data appears to be corrupted - invalid signature')
        }
        
        blobObject = new Blob([responseData], { type: 'application/zip' })
        
      } else if (typeof responseData === 'string') {
        setProcessingStage('Decoding base64 string...')
        
        const cleanBase64 = responseData.replace(/[\r\n\s]/g, '')
        blobObject = decodeBase64Efficiently(cleanBase64, (progress) => {
          setProgress(progress.percentage)
          setProcessingStage(`Decoding base64: ${progress.percentage}%`)
        })
        
        updateMemoryInfo()
        
        // Final validation
        const finalValid = await validateZipSignature(blobObject)
        if (!finalValid) {
          console.error('❌ Final ZIP validation failed - file may be corrupted')
        }
        
      } else {
        throw new Error('Unsupported response data type for ZIP file')
      }

      setProcessingStage('Saving file...')
      saveFileEfficiently(blobObject, fileName, (progress) => {
        if (progress.completed) {
          setProcessingStage('File saved successfully!')
        }
      })
      
      // Force garbage collection after processing
      forceGC()
      updateMemoryInfo()
      
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const downloadFileStreaming = async () => {
    console.log('🚀 Starting streaming download...')
    
    // Create abort controller for fetch
    abortControllerRef.current = new AbortController()
    
    try {
      const requestBody = createDownloadRequest(
        downloadRequest.requestId,
        downloadRequest.type,
        parseInt(downloadRequest.part)
      )
      
      const headers = getHeaders()
      
      setDownloadInfo({
        fileName: downloadRequest.fileName,
        type: downloadRequest.type,
        part: downloadRequest.part,
        requestId: downloadRequest.requestId,
        status: 'Starting streaming download...',
        method: 'streaming'
      })
      
      updateMemoryInfo()
      
      // Use streaming download
      const response = await streamingDownload(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD}`,
        requestBody,
        headers,
        (progress) => {
          setProgress(progress.percentage)
          setDownloadInfo(prev => ({
            ...prev,
            status: `Downloading... ${progress.percentage}%`,
            loaded: progress.loaded,
            total: progress.total
          }))
          updateMemoryInfo()
        }
      )
      
      console.log('📡 Streaming download completed, size:', response.size)
      
      // Gunakan content-type dari response header server (sama seperti classic)
      const contentType = response.contentType || response.headers?.get('content-type') || 'application/octet-stream'
      console.log('Content-Type yang digunakan:', contentType)
      
      // Tentukan nama file dengan extension yang sesuai
      const correctedFileName = ensureCorrectFileExtension(downloadRequest.fileName, contentType)
      console.log('File name yang akan digunakan:', correctedFileName)
      
      let blob
      
      // Handle berdasarkan content-type (sama seperti classic)
      if (contentType.includes('text/csv')) {
        console.log('📄 Processing as CSV file')
        blob = saveStreamCSV(correctedFileName, response)
      } else if (contentType.includes('application/zip')) {
        console.log('📦 Processing as ZIP file')
        blob = await saveStreamZIP(correctedFileName, response)
      } else {
        console.log('❓ Unknown content-type, treating as CSV')
        blob = saveStreamCSV(correctedFileName, response)
      }
      
      setSuccess(`File ${correctedFileName} berhasil didownload dengan streaming! (${formatFileSize(blob.size)})`)
      setDownloadInfo(prev => ({
        ...prev,
        status: 'Download completed (streaming)',
        completed: true,
        fileSize: blob.size,
        contentType: contentType,
        actualFileName: correctedFileName
      }))
      
      // Aggressive memory cleanup after successful download
      console.log('🧹 Starting post-download memory cleanup...')
      cleanupMemory()
      
    } catch (error) {
      console.error('❌ Streaming download error:', error)
      
      // Also cleanup memory on error
      cleanupMemory()
      throw error
    }
  }

  const downloadFileClassic = async () => {
    console.log('📡 Starting classic download...')
    
    // Create cancel token for axios
    cancelTokenRef.current = axios.CancelToken.source()
    
    try {
      const requestBody = createDownloadRequest(
        downloadRequest.requestId,
        downloadRequest.type,
        parseInt(downloadRequest.part)
      )
      
      const headers = getHeaders()
      
      setDownloadInfo({
        fileName: downloadRequest.fileName,
        type: downloadRequest.type,
        part: downloadRequest.part,
        requestId: downloadRequest.requestId,
        status: 'Starting classic download...',
        method: 'classic'
      })
      
      updateMemoryInfo()
      
      const response = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOWNLOAD}`, requestBody, {
        headers,
        responseType: 'blob',
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
            updateMemoryInfo()
          }
        },
        timeout: API_CONFIG.TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      
      console.log('📡 Classic download completed')
      
      const contentType = response.headers['content-type'] || 'application/octet-stream'
      const correctedFileName = ensureCorrectFileExtension(downloadRequest.fileName, contentType)
      
      let blob
      if (contentType.includes('text/csv')) {
        blob = saveStreamCSV(correctedFileName, response.data)
      } else if (contentType.includes('application/zip')) {
        blob = await saveStreamZIP(correctedFileName, response.data)
      } else {
        blob = saveStreamCSV(correctedFileName, response.data)
      }
      
      setSuccess(`File ${correctedFileName} berhasil didownload! (${formatFileSize(blob.size)})`)
      setDownloadInfo(prev => ({
        ...prev,
        status: 'Download completed (classic)',
        completed: true,
        fileSize: blob.size,
        contentType: contentType,
        actualFileName: correctedFileName
      }))
      
      // Aggressive memory cleanup after successful download
      console.log('🧹 Starting post-download memory cleanup...')
      cleanupMemory()
      
    } catch (error) {
      console.error('❌ Classic download error:', error)
      
      // Also cleanup memory on error
      cleanupMemory()
      throw error
    }
  }

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
    setProcessingStage('')
    setMemoryInfo(null)

    try {
      if (useStreaming) {
        await downloadFileStreaming()
      } else {
        await downloadFileClassic()
      }
      
    } catch (err) {
      console.error('Download error:', err)
      let errorMessage = 'Terjadi kesalahan saat download'
      
      if (axios.isCancel(err)) {
        errorMessage = 'Download dibatalkan'
      } else if (err.name === 'AbortError') {
        errorMessage = 'Streaming download dibatalkan'
      } else if (err.response) {
        errorMessage = `Error ${err.response.status}: ${err.response.statusText}`
      } else if (err.request) {
        errorMessage = 'Tidak dapat terhubung ke server'
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Download timeout - file terlalu besar atau koneksi lambat'
      } else {
        errorMessage = err.message || 'Terjadi kesalahan tidak diketahui'
      }
      
      setError(errorMessage)
      setDownloadInfo(prev => prev ? {
        ...prev,
        status: 'Download failed',
        error: true
      } : null)
    } finally {
      setDownloading(false)
      setProgress(0)
      setProcessingStage('')
      cancelTokenRef.current = null
      abortControllerRef.current = null
      
      // Aggressive final memory cleanup
      console.log('🧹 Starting final memory cleanup...')
      
      // Multiple cleanup attempts with delays
      setTimeout(() => {
        cleanupMemory()
      }, 100)
      
      setTimeout(() => {
        cleanupMemory()
      }, 500)
      
      setTimeout(() => {
        cleanupMemory()
      }, 1000)
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
    setProcessingStage('')
    setMemoryInfo(null)
  }

  return (
    <div className="download-form">
      <h2>Download Report Part (Memory Optimized)</h2>
      
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(e) => setUseStreaming(e.target.checked)}
          />
          Use Memory-Efficient Streaming (Recommended for large files)
        </label>
      </div>
      
      <div className="form-group">
        <label htmlFor="requestId">Request ID *</label>
        <input
          type="text"
          id="requestId"
          name="requestId"
          value={downloadRequest.requestId}
          onChange={handleInputChange}
          placeholder="Masukkan Request ID"
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
          placeholder="Masukkan Part"
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
          placeholder="contoh: report-summary"
          disabled={downloading}
        />
      </div>

      <div className="form-group">
        <button 
          className="btn btn-primary" 
          onClick={downloadFile}
          disabled={downloading}
        >
          {downloading && <div className="loading-spinner"></div>}
          {downloading ? 'Downloading...' : `Download File ${useStreaming ? '(Streaming)' : '(Classic)'}`}
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
          {processingStage && (
            <div className="processing-stage">
              {processingStage}
            </div>
          )}
        </div>
      )}

      {memoryInfo && (
        <div className="memory-info">
          <h4>Memory Usage</h4>
          <p>Used: {memoryInfo.used}MB / {memoryInfo.total}MB (Limit: {memoryInfo.limit}MB)</p>
          <div className="memory-bar">
            <div 
              className="memory-fill" 
              style={{ width: `${(memoryInfo.used / memoryInfo.limit) * 100}%` }}
            />
          </div>
        </div>
      )}

      {downloadInfo && (
        <div className="download-info">
          <h3>Download Info</h3>
          <p><strong>Method:</strong> {downloadInfo.method?.toUpperCase()}</p>
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

export default FileDownloaderOptimized
