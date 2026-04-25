import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import Layout from './Layout';
import Appointments from './pages/Appointments';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';

function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  
  console.log("App state - token present:", !!token);

  const handleLogin = (t) => {
    console.log("handleLogin called with token:", !!t);
    localStorage.setItem('admin_token', t);
    setToken(t);
  };

  const handleLogout = () => {
    console.log("handleLogout called");
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  if (!token) {
    console.log("No token, rendering Login page");
    return <Login onLogin={handleLogin} />;
  }

  console.log("Token present, rendering Layout and Routes");

  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
