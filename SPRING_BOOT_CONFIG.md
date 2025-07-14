# Konfigurasi Spring Boot untuk File Download

## 1. Controller Configuration

Controller sudah tersedia di: `ReportDownloadController.java`

Pastikan property ini ada di `application.properties`:
```properties
# Path endpoint untuk download
report.download.request.path=/report/download

# Konfigurasi untuk file upload/download
spring.servlet.multipart.max-file-size=1GB
spring.servlet.multipart.max-request-size=1GB

# Timeout untuk request
server.connection-timeout=300000
```

## 2. CORS Configuration

Tambahkan konfigurasi CORS agar React app bisa akses API:

```java
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:3000")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
```

## 3. Response Headers untuk Download

Pastikan controller mengembalikan response dengan headers yang tepat:

```java
@RequestMapping(value = {"#{${report.download.request.path}}"}, method = RequestMethod.POST)
public ResponseEntity<Resource> ReportDownloadRequest(@RequestBody ReportDownloadRequest request,
        @RequestHeader HttpHeaders headers) {
    
    // ... business logic ...
    
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
        .header(HttpHeaders.CONTENT_TYPE, "application/octet-stream")
        .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(resource.contentLength()))
        .body(resource);
}
```

## 4. Error Handling

Tambahkan exception handler untuk menangani error download:

```java
@ControllerAdvice
public class DownloadExceptionHandler {

    @ExceptionHandler(IOException.class)
    public ResponseEntity<String> handleIOException(IOException e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error processing file: " + e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
                .body("Invalid request: " + e.getMessage());
    }
}
```

## 5. Streaming untuk File Besar

Untuk file besar, gunakan streaming response:

```java
@RequestMapping(value = {"#{${report.download.request.path}}"}, method = RequestMethod.POST)
public void downloadLargeFile(@RequestBody ReportDownloadRequest request,
        HttpServletResponse response) throws IOException {
    
    // Set response headers
    response.setContentType("application/octet-stream");
    response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
    
    // Stream file content
    try (InputStream inputStream = getFileInputStream(request);
         OutputStream outputStream = response.getOutputStream()) {
        
        byte[] buffer = new byte[8192]; // 8KB buffer
        int bytesRead;
        while ((bytesRead = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, bytesRead);
        }
        outputStream.flush();
    }
}
```
