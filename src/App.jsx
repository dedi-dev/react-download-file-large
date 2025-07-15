import { useState } from 'react'
import FileDownloader from './components/FileDownloader'
import FileDownloaderOptimized from './components/FileDownloaderOptimized'
import './App.css'
import './components/FileDownloaderOptimized.css'

function App() {
  const [useOptimized, setUseOptimized] = useState(false)

  return (
    <div className="App">
      <div className="download-container">
        <h1>Report Download Manager</h1>
        <p>Download report parts berdasarkan request ID dan type</p>
        
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <button 
            onClick={() => setUseOptimized(!useOptimized)}
            style={{
              padding: '10px 20px',
              backgroundColor: useOptimized ? '#28a745' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {useOptimized ? 'Using Memory-Optimized Version' : 'Using Classic Version'}
          </button>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {useOptimized 
              ? 'Memory-efficient streaming untuk file besar (500MB+)'
              : 'Classic axios-based download'
            }
          </p>
        </div>
        
        {useOptimized ? <FileDownloaderOptimized /> : <FileDownloader />}
      </div>
    </div>
  )
}

export default App
