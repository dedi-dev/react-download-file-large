import FileDownloader from './components/FileDownloader'
import './App.css'

function App() {
  return (
    <div className="App">
      <div className="download-container">
        <h1>Report Download Manager</h1>
        <p>Download report parts berdasarkan request ID dan type</p>
        <FileDownloader />
      </div>
    </div>
  )
}

export default App
