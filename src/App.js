import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Predictions from './pages/Predictions';
import './index.css';

const App = () => {
  return (
    <Router>
      <div className="bg-gray-50 min-h-screen pb-16"> {/* Added padding-bottom to make room for the footer */}
        <Routes>
          <Route exact path="/" element={<Home />} />
          <Route path="/predictions" element={<Predictions />} />
        </Routes>
        <Navbar />
      </div>
    </Router>
  );
};

export default App;
