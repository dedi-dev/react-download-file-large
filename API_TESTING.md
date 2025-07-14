# Test API Examples

## Test dengan curl

### 1. Test Basic Download
```bash
curl -X POST http://localhost:8080/report/download \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "test-report-001",
    "format": "csv",
    "parameters": {
      "startDate": "2024-01-01",
      "endDate": "2024-12-31"
    },
    "fileName": "test-report.csv"
  }' \
  --output test-report.csv
```

### 2. Test ZIP Download
```bash
curl -X POST http://localhost:8080/report/download \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "test-report-002",
    "format": "zip",
    "parameters": {},
    "fileName": "test-report.zip"
  }' \
  --output test-report.zip
```

## Test dengan Postman

### Request
- **Method**: POST
- **URL**: `http://localhost:8080/report/download`
- **Headers**:
  - `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "reportId": "test-report-001",
  "format": "csv",
  "parameters": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  },
  "fileName": "test-report.csv"
}
```

### Expected Response
- **Status**: 200 OK
- **Headers**:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="test-report.csv"`
- **Body**: Binary file content

## Test dengan JavaScript (Browser Console)

```javascript
// Test API dari browser console
fetch('/api/report/download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    reportId: 'test-report-001',
    format: 'csv',
    parameters: {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    },
    fileName: 'test-report.csv'
  })
})
.then(response => response.blob())
.then(blob => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'test-report.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
});
```

## Mock Server untuk Testing

Jika belum ada Spring Boot server, Anda bisa menggunakan mock server:

### 1. Install json-server
```bash
npm install -g json-server
```

### 2. Buat file mock-server.js
```javascript
const jsonServer = require('json-server');
const server = jsonServer.create();
const middlewares = jsonServer.defaults();

server.use(middlewares);

// Mock endpoint untuk download
server.post('/report/download', (req, res) => {
  const { reportId, format, fileName } = req.body;
  
  // Simulasi delay untuk file besar
  setTimeout(() => {
    // Generate dummy content
    let content = '';
    if (format === 'csv') {
      content = 'id,name,date\n1,Test,2024-01-01\n2,Sample,2024-01-02';
    } else {
      content = 'This is a test zip file content';
    }
    
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': content.length
    });
    
    res.send(content);
  }, 1000);
});

server.listen(8080, () => {
  console.log('Mock server is running on port 8080');
});
```

### 3. Jalankan mock server
```bash
node mock-server.js
```
