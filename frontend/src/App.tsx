import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FirebaseProvider } from './contexts/FirebaseContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Screening from './pages/Screening';
import SelfCare from './pages/SelfCare';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Chatbot from './pages/Chatbot';
import './App.css';

function App() {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <Navbar />
            <main className="min-h-screen bg-gray-50">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/screening" element={<Screening />} />
                <Route path="/selfcare" element={<SelfCare />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/chatbot" element={<Chatbot />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </FirebaseProvider>
  );
}

export default App;
