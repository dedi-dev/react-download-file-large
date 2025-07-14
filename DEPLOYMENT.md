# Deployment Guide

## Build untuk Production

### 1. Build aplikasi React
```bash
npm run build
```

### 2. Preview build hasil
```bash
npm run preview
```

## Deployment Options

### Option 1: Static Hosting (Netlify, Vercel, etc.)

1. Build aplikasi
2. Upload folder `dist` ke hosting
3. Konfigurasi proxy untuk API calls ke Spring Boot server

### Option 2: Nginx + Spring Boot

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Serve React app
    location / {
        root /var/www/react-app/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API calls to Spring Boot
    location /api/ {
        proxy_pass http://localhost:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # For large file downloads
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_max_temp_file_size 0;
        client_max_body_size 1G;
    }
}
```

### Option 3: Docker Deployment

#### Dockerfile untuk React App
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  react-app:
    build: .
    ports:
      - "3000:80"
    depends_on:
      - spring-boot-app
  
  spring-boot-app:
    image: your-spring-boot-app:latest
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=production
```

## Environment Configuration

### Development
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
```

### Production
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  base: '/react-download-file/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
```

## Performance Optimization

### 1. Code Splitting
```javascript
// Lazy load components
const FileDownloader = lazy(() => import('./components/FileDownloader'));
```

### 2. Bundle Analysis
```bash
npm run build -- --analyze
```

### 3. Gzip Compression
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

## Security Considerations

### 1. CORS Configuration
```java
@CrossOrigin(origins = "https://yourdomain.com")
@RestController
public class ReportDownloadController {
    // ...
}
```

### 2. File Size Limits
```properties
# application.properties
spring.servlet.multipart.max-file-size=1GB
spring.servlet.multipart.max-request-size=1GB
```

### 3. Rate Limiting
```java
@RateLimiter(name = "download", fallbackMethod = "downloadFallback")
@RequestMapping("/download")
public ResponseEntity<?> download() {
    // ...
}
```

## Monitoring & Logging

### 1. Application Metrics
```javascript
// Add to FileDownloader component
const trackDownload = (fileName, fileSize) => {
  // Send metrics to monitoring service
  analytics.track('file_download', {
    fileName,
    fileSize,
    timestamp: new Date().toISOString()
  });
};
```

### 2. Error Tracking
```javascript
// Add error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Download error:', error, errorInfo);
    // Send to error tracking service
  }
}
```

## Health Checks

### Frontend
```javascript
// Add to utils/health.js
export const checkAPIHealth = async () => {
  try {
    const response = await fetch('/api/health');
    return response.ok;
  } catch (error) {
    return false;
  }
};
```

### Backend
```java
@RestController
public class HealthController {
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
```
