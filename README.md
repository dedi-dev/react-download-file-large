# React Download File

Aplikasi React untuk mendownload file CSV dan ZIP berukuran besar dari Spring Boot API.

## ✅ Fitur Lengkap

### Core Features
- ✅ **Download File Besar** - Support file CSV dan format lainnya >500MB
- ✅ **Progress Tracking** - Real-time progress bar dan informasi size
- ✅ **Error Handling** - Comprehensive error handling dengan retry mechanism
- ✅ **Cancel Download** - Kemampuan untuk cancel download yang sedang berjalan
- ✅ **Automatic Retry** - Retry otomatis untuk network errors (3x)
- ✅ **Part Download** - Download berdasarkan request ID, type, dan part
- ✅ **Timeout Management** - Timeout handling untuk large files (5 menit)
- ✅ **Loading States** - Loading spinner dan status yang jelas
- ✅ **Responsive UI** - Interface yang mobile-friendly
- ✅ **Smart File Extension** - Otomatis menambahkan extension berdasarkan content-type server

### Advanced Features
- ✅ **Stream Processing** - Chunked download untuk memory efficiency
- ✅ **Blob Handling** - Proper blob management untuk file besar
- ✅ **Browser Compatibility** - Support untuk modern browsers
- ✅ **Configuration API** - Centralized API configuration
- ✅ **Memory Management** - Automatic cleanup untuk prevent memory leaks

### Technical Features
- ✅ **TypeScript Ready** - Prepared for TypeScript migration
- ✅ **ESLint Configuration** - Code quality assurance
- ✅ **Vite Build Tool** - Fast development dan build
- ✅ **CSS Modules** - Scoped styling
- ✅ **Error Boundaries** - Graceful error handling
- ✅ **Performance Optimized** - Lazy loading dan code splitting ready

## 📁 Struktur Project

```
react-download-file/
├── src/
│   ├── components/
│   │   └── FileDownloader.jsx     # Main download component
│   ├── utils/
│   │   └── api.js                 # API configuration
│   ├── App.jsx                    # Main application
│   ├── main.jsx                   # Entry point
│   └── index.css                  # Global styles
├── public/
├── .github/
│   └── copilot-instructions.md    # Copilot configuration
├── .vscode/
│   └── tasks.json                 # VS Code tasks
├── package.json
├── vite.config.js                 # Vite configuration
├── README.md
├── SPRING_BOOT_CONFIG.md          # Spring Boot setup guide
├── API_TESTING.md                 # API testing examples
├── DEPLOYMENT.md                  # Deployment guide
└── ADVANCED_FEATURES.md           # Additional features guide
```

## Teknologi yang Digunakan

- **React 18** - Library UI
- **Vite** - Build tool yang cepat
- **Axios** - HTTP client untuk API calls
- **CSS3** - Styling

## Cara Menjalankan Aplikasi

### Prerequisites
- Node.js (versi 14 atau lebih baru)
- Spring Boot server berjalan di port 8080

### Instalasi
1. Install dependencies:
   ```bash
   npm install
   ```

### Menjalankan Aplikasi

#### Metode 1: Menggunakan NPM (Jika PowerShell execution policy normal)
```bash
npm run dev
```

#### Metode 2: Menggunakan file batch (Untuk Windows dengan PowerShell execution policy disabled)
```cmd
dev.cmd
```

#### Metode 3: Menggunakan node langsung
```bash
node node_modules/vite/bin/vite.js
```

#### Metode 4: Menggunakan VS Code Task
1. Buka VS Code
2. Tekan `Ctrl+Shift+P`
3. Ketik "Tasks: Run Task"
4. Pilih "Start Development Server" atau "Start Dev Server (CMD)"

### Mengakses Aplikasi
Setelah server berjalan, buka browser dan akses:
```
http://localhost:3000
```

### Troubleshooting PowerShell Execution Policy
Jika mendapat error "running scripts is disabled on this system", ada beberapa solusi:

1. **Sementara** (hanya untuk session ini):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   ```

2. **Permanen** (untuk user saat ini):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Gunakan file batch** yang sudah disediakan:
   ```cmd
   dev.cmd
   ```

## 📚 Dokumentasi Lengkap

- **[SPRING_BOOT_CONFIG.md](./SPRING_BOOT_CONFIG.md)** - Konfigurasi Spring Boot untuk file download
- **[API_TESTING.md](./API_TESTING.md)** - Contoh testing API dan mock server
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guide deployment untuk production
- **[ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md)** - Fitur tambahan yang bisa diimplementasi

## 🔧 Konfigurasi API

Aplikasi ini dikonfigurasi untuk berkomunikasi dengan Spring Boot API pada `http://localhost:9191/apireport`. Anda dapat mengubah konfigurasi ini di file `src/utils/api.js`:

```javascript
export const API_CONFIG = {
  BASE_URL: '/api',
  ENDPOINTS: {
    DOWNLOAD: '/report-download'
  },
  TIMEOUT: 300000, // 5 minutes
  MAX_RETRIES: 3
}
```

Atau di file `vite.config.js` untuk proxy:

```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:9191', // Ubah sesuai server Anda
      changeOrigin: true,
      secure: false,
      rewrite: (path) => path.replace(/^\/api/, '/apireport')
    }
  }
}
```

## Struktur Request API

Aplikasi mengirim POST request ke endpoint `/api/report-download` dengan body:

```json
{
  "request-id": "40896a5d-7b10-41b2-b751-e2ce601aed14",
  "type": "summary",
  "part": 1
}
```

### Parameter yang Diperlukan:
- **request-id**: UUID untuk mengidentifikasi request
- **type**: Jenis report (`summary`, `detail`, `report`)
- **part**: Nomor bagian report (integer, minimal 1)

## Cara Penggunaan

1. **Request ID**: Masukkan UUID untuk mengidentifikasi request (contoh: 40896a5d-7b10-41b2-b751-e2ce601aed14)
2. **Type**: Pilih jenis report (summary, detail, atau report)
3. **Part**: Masukkan nomor bagian report (dimulai dari 1)
4. **Nama File**: Masukkan nama file tanpa extension (extension akan otomatis ditambahkan berdasarkan content-type dari server)
5. Klik **Download File** untuk memulai download

### Catatan Penting:
- **File Extension Otomatis**: Aplikasi akan menambahkan extension yang sesuai berdasarkan `content-type` header dari server
- **Content-Type Support**: Mendukung berbagai format seperti CSV, JSON, PDF, ZIP, dll
- **Real-time Info**: Menampilkan content-type dan nama file sebenarnya di download info

## Fitur Khusus untuk File Besar

- **Progress Tracking**: Menampilkan progress real-time selama download
- **Chunked Download**: Mendukung download file dalam chunk
- **Timeout Handling**: Timeout 5 menit untuk file besar
- **Error Recovery**: Handling error dengan pesan yang jelas
- **Memory Management**: Menggunakan Blob API untuk handling file besar

## Scripts yang Tersedia

- `npm run dev` - Menjalankan development server
- `npm run build` - Build aplikasi untuk production
- `npm run preview` - Preview build production
- `npm run lint` - Menjalankan ESLint

## Browser Support

Aplikasi ini mendukung browser modern yang mendukung:
- ES2020 features
- Blob API
- Fetch API
- CSS Grid dan Flexbox

## 🔍 Troubleshooting

### Download Gagal
1. **Periksa Server** - Pastikan Spring Boot server berjalan di port 9191
2. **Periksa Koneksi** - Test koneksi internet untuk file besar
3. **Validate Input** - Pastikan Request ID valid (format UUID) dan part > 0
4. **Check CORS** - Pastikan CORS dikonfigurasi dengan benar di server

### File Tidak Terdownload
1. **Pop-up Blocker** - Periksa pop-up blocker di browser
2. **Browser Support** - Pastikan browser mendukung automatic download
3. **Storage Space** - Cek storage space yang tersedia
4. **File Permissions** - Pastikan ada permission untuk download

### Progress Tidak Muncul
1. **Content-Length Header** - Server harus mengirim header `Content-Length`
2. **Stream Response** - Pastikan response berupa stream data
3. **Network Issues** - Periksa koneksi network yang stabil

### Error PowerShell Execution Policy
Jika mendapat error "running scripts is disabled on this system":

1. **Sementara** (session ini saja):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   ```

2. **User saat ini**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. **Gunakan file batch**:
   ```cmd
   dev.cmd
   ```

## ❓ FAQ

**Q: Bagaimana cara mengubah timeout untuk file besar?**
A: Edit `API_CONFIG.TIMEOUT` di `src/utils/api.js`

**Q: Bisa menambahkan type file lain selain summary, detail, dan report?**
A: Ya, edit dropdown di `FileDownloader.jsx` dan sesuaikan dengan API server

**Q: Apakah aplikasi ini bisa handle multiple download bersamaan?**
A: Saat ini hanya single download, tapi bisa diimplementasi (lihat `ADVANCED_FEATURES.md`)

**Q: Bagaimana cara menambahkan authentication?**
A: Tambahkan header authorization di `src/utils/api.js` (sudah ada Bearer token)

**Q: Apakah ada batasan ukuran file?**
A: Tidak ada batasan di frontend, batasan ada di server dan browser memory

**Q: Format request-id harus UUID?**
A: Ya, sebaiknya menggunakan UUID untuk konsistensi dengan server

## 🚀 Fitur Mendatang

Lihat **[ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md)** untuk fitur-fitur yang bisa diimplementasi:

- 📊 Download History
- 🔄 Batch Download
- ⏳ Download Queue Management
- 📈 Download Analytics
- 👁️ File Preview
- 📊 Download Speed Monitor
- ⏸️ Resume Download
- ⏰ Download Scheduler
- 🔔 Download Notifications
- 🛡️ Advanced Error Handling

## Kontribusi

1. Fork repository
2. Buat feature branch
3. Commit perubahan Anda
4. Push ke branch
5. Buat Pull Request

## License

MIT License
