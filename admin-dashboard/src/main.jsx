import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Global Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || this.state.error?.toString() || "Unknown Error";
      return (
        <div style={{ padding: '40px', color: '#ef4444', background: '#ffffff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ marginBottom: '20px' }}>Frontend Crash Detected</h1>
          <p style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>{errorMsg}</p>
          <div style={{ marginBottom: '20px', color: '#64748b', fontSize: '13px' }}>
            Try clearing your browser data if this persists.
          </div>
          <pre style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', overflow: 'auto', fontSize: '12px', border: '1px solid #e2e8f0' }}>
            {this.state.error?.stack || "No stack trace available."}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
            style={{ marginTop: '20px', padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
          >
            Clear Data & Restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log("Admin Dashboard Mounting...");

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
)
