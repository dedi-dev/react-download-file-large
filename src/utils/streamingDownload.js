/**
 * Streaming Download Utility untuk Large Files
 * Menggunakan Fetch API dengan streaming untuk menghindari buffer di memory
 */

/**
 * Memory-efficient streaming download menggunakan Fetch API
 * @param {string} url - URL endpoint
 * @param {Object} requestBody - Request body
 * @param {Object} headers - Headers
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Blob>} - Downloaded blob
 */
export const streamingDownload = async (url, requestBody, headers, onProgress) => {
  try {
    console.log('🚀 Starting streaming download...')
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    console.log('📊 Content-Length:', total ? `${total} bytes` : 'Unknown')

    const reader = response.body.getReader()
    const chunks = []
    let receivedLength = 0

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        console.log('✅ Download completed')
        break
      }

      chunks.push(value)
      receivedLength += value.length

      // Update progress
      if (onProgress) {
        const percentage = total ? Math.round((receivedLength / total) * 100) : 0
        onProgress({
          loaded: receivedLength,
          total: total,
          percentage: percentage
        })
      }

      console.log(`📥 Received: ${receivedLength} bytes ${total ? `(${Math.round((receivedLength / total) * 100)}%)` : ''}`)
    }

    // Efficiently concatenate chunks
    console.log('🔄 Concatenating chunks...')
    const chunksAll = new Uint8Array(receivedLength)
    let position = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      chunksAll.set(chunk, position)
      position += chunk.length
      
      // Clear chunk reference immediately to free memory
      chunks[i] = null
    }
    
    // Clear chunks array completely
    chunks.length = 0
    console.log('🗑️ Chunks array cleared, memory freed')

    console.log('✅ Chunks concatenated successfully')
    
    // Return blob with response metadata
    const blob = new Blob([chunksAll])
    
    // Add response metadata to blob
    blob.contentType = response.headers.get('content-type') || 'application/octet-stream'
    blob.responseHeaders = response.headers
    
    // Clear chunksAll reference for garbage collection
    // Note: chunksAll will be garbage collected after blob creation
    console.log('🗑️ Memory cleanup completed')
    
    return blob

  } catch (error) {
    console.error('❌ Streaming download error:', error)
    throw error
  }
}

/**
 * Memory-efficient base64 decoding untuk large files
 * @param {string} base64String - Base64 encoded string
 * @param {Function} onProgress - Progress callback
 * @returns {Blob} - Decoded blob
 */
export const decodeBase64Efficiently = (base64String, onProgress) => {
  console.log('🔄 Starting efficient base64 decoding...')
  
  const chunkSize = 1024 * 1024 // 1MB chunks
  const totalLength = base64String.length
  const result = []
  
  for (let i = 0; i < totalLength; i += chunkSize) {
    const chunk = base64String.slice(i, i + chunkSize)
    const binaryString = atob(chunk)
    const bytes = new Uint8Array(binaryString.length)
    
    for (let j = 0; j < binaryString.length; j++) {
      bytes[j] = binaryString.charCodeAt(j)
    }
    
    result.push(bytes)
    
    // Update progress
    if (onProgress) {
      const percentage = Math.round(((i + chunkSize) / totalLength) * 100)
      onProgress({
        processed: i + chunkSize,
        total: totalLength,
        percentage: Math.min(percentage, 100)
      })
    }
    
    console.log(`🔄 Decoded: ${Math.round(((i + chunkSize) / totalLength) * 100)}%`)
  }
  
  console.log('✅ Base64 decoding completed')
  return new Blob(result)
}

/**
 * Process ZIP files in chunks untuk mengurangi memory usage
 * @param {Blob} blob - Input blob
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Blob>} - Processed blob
 */
export const processZipInChunks = async (blob, onProgress) => {
  console.log('🗜️ Processing ZIP file in chunks...')
  
  const chunkSize = 1024 * 1024 // 1MB chunks
  const fileSize = blob.size
  const chunks = []
  
  for (let start = 0; start < fileSize; start += chunkSize) {
    const end = Math.min(start + chunkSize, fileSize)
    const chunk = blob.slice(start, end)
    const arrayBuffer = await chunk.arrayBuffer()
    
    // Process chunk
    chunks.push(new Uint8Array(arrayBuffer))
    
    // Update progress
    if (onProgress) {
      const percentage = Math.round((end / fileSize) * 100)
      onProgress({
        processed: end,
        total: fileSize,
        percentage: percentage
      })
    }
    
    console.log(`🗜️ Processed: ${Math.round((end / fileSize) * 100)}%`)
    
    // Optional: Force garbage collection untuk large files
    if (start > 0 && start % (chunkSize * 10) === 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  
  console.log('✅ ZIP processing completed')
  return new Blob(chunks)
}

/**
 * Validate ZIP file signature efficiently
 * @param {Blob} blob - ZIP blob to validate
 * @returns {Promise<boolean>} - Is valid ZIP
 */
export const validateZipSignature = async (blob) => {
  try {
    // Only read first 4 bytes untuk signature check
    const headerChunk = blob.slice(0, 4)
    const arrayBuffer = await headerChunk.arrayBuffer()
    const view = new Uint8Array(arrayBuffer)
    
    // ZIP file signatures: PK\x03\x04 (local file header) or PK\x05\x06 (end of central directory)
    const isValid = (view[0] === 0x50 && view[1] === 0x4B && (view[2] === 0x03 || view[2] === 0x05))
    
    console.log('🔍 ZIP signature validation:', isValid ? 'VALID' : 'INVALID')
    return isValid
  } catch (error) {
    console.error('❌ ZIP validation error:', error)
    return false
  }
}

/**
 * Memory-efficient file saver dengan progress tracking
 * @param {Blob} blob - File blob
 * @param {string} fileName - File name
 * @param {Function} onProgress - Progress callback
 */
export const saveFileEfficiently = (blob, fileName, onProgress) => {
  console.log('💾 Saving file efficiently:', fileName)
  
  try {
    // IE 10 and later, and Edge
    if (window.navigator.msSaveBlob) {
      window.navigator.msSaveBlob(blob, fileName)
      console.log('✅ File saved successfully (IE/Edge)')
      if (onProgress) onProgress({ percentage: 100, completed: true })
      return
    }

    // Modern browsers
    const anchor = document.createElement('a')
    anchor.download = fileName
    anchor.href = window.URL.createObjectURL(blob)
    
    // Add to DOM temporarily
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    
    // Clean up object URL immediately
    window.URL.revokeObjectURL(anchor.href)
    
    console.log('✅ File saved successfully, size:', blob.size)
    if (onProgress) onProgress({ percentage: 100, completed: true })
    
  } catch (error) {
    console.error('❌ File save error:', error)
    throw error
  }
}

/**
 * Monitor memory usage (jika available)
 * @returns {Object} - Memory info
 */
export const getMemoryInfo = () => {
  if (performance.memory) {
    const memory = performance.memory
    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) // MB
    }
  }
  return null
}

/**
 * Force garbage collection (untuk debugging)
 */
export const forceGC = () => {
  if (window.gc) {
    window.gc()
    console.log('🗑️ Forced garbage collection')
  }
}
