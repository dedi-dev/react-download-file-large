# Memory Optimization untuk Large File Download

## Masalah Current Implementation

Aplikasi saat ini menggunakan `responseType: 'blob'` yang menyimpan seluruh file di RAM sebelum disimpan ke disk.

### Memory Usage untuk File 500MB+:
- **Download**: ~500MB di RAM
- **Processing**: ~1000MB di RAM (double buffer)
- **Total**: Bisa mencapai 1.5GB+ RAM usage

## Solusi Optimasi Memory

### 1. **Streaming Download dengan Fetch API**
```javascript
const streamDownload = async (url, requestBody, headers) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })
  
  const reader = response.body.getReader()
  const chunks = []
  let receivedLength = 0
  
  while (true) {
    const { done, value } = await reader.read()
    
    if (done) break
    
    chunks.push(value)
    receivedLength += value.length
    
    // Update progress
    onProgress(receivedLength, response.headers.get('content-length'))
  }
  
  // Concatenate chunks efficiently
  const chunksAll = new Uint8Array(receivedLength)
  let position = 0
  
  for (let chunk of chunks) {
    chunksAll.set(chunk, position)
    position += chunk.length
  }
  
  return new Blob([chunksAll])
}
```

### 2. **Streaming dengan Web Streams API**
```javascript
const streamingDownload = async (url, requestBody, headers) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  })
  
  // Create writable stream directly to file
  const fileStream = streamSaver.createWriteStream('filename.zip')
  const writer = fileStream.getWriter()
  
  // Pipe response directly to file
  const reader = response.body.getReader()
  
  const pump = () => reader.read().then(({ done, value }) => {
    if (done) {
      writer.close()
      return
    }
    
    writer.write(value)
    return pump()
  })
  
  return pump()
}
```

### 3. **Chunked Processing untuk ZIP Files**
```javascript
const processZipInChunks = async (blob) => {
  const chunkSize = 1024 * 1024 // 1MB chunks
  const fileSize = blob.size
  const chunks = []
  
  for (let start = 0; start < fileSize; start += chunkSize) {
    const end = Math.min(start + chunkSize, fileSize)
    const chunk = blob.slice(start, end)
    const arrayBuffer = await chunk.arrayBuffer()
    
    // Process chunk
    chunks.push(new Uint8Array(arrayBuffer))
    
    // Optional: Force garbage collection
    if (start > 0 && start % (chunkSize * 10) === 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  
  return new Blob(chunks)
}
```

### 4. **Memory-Efficient Base64 Decoding**
```javascript
const decodeBase64Efficiently = (base64String) => {
  const chunkSize = 1024 * 1024 // 1MB chunks
  const result = []
  
  for (let i = 0; i < base64String.length; i += chunkSize) {
    const chunk = base64String.slice(i, i + chunkSize)
    const binaryString = atob(chunk)
    const bytes = new Uint8Array(binaryString.length)
    
    for (let j = 0; j < binaryString.length; j++) {
      bytes[j] = binaryString.charCodeAt(j)
    }
    
    result.push(bytes)
  }
  
  return new Blob(result)
}
```

## Rekomendasi Implementation

1. **Gunakan Fetch API** dengan streaming untuk menghindari axios buffer
2. **Implement StreamSaver.js** untuk direct-to-disk writing
3. **Process data in chunks** untuk mengurangi memory footprint
4. **Add memory monitoring** untuk tracking usage

## Library yang Disarankan

- **StreamSaver.js**: Direct file writing tanpa buffer di memory
- **Web Streams API**: Native browser streaming
- **Service Worker**: Untuk processing di background thread
