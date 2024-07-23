import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaChartLine } from 'react-icons/fa';

const Navbar = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-blue-600 p-4 text-white flex justify-around">
      <Link to="/" className="flex flex-col items-center">
        <FaHome className="text-2xl" />
        <span className="text-sm">Home</span>
      </Link>
      <Link to="/predictions" className="flex flex-col items-center">
        <FaChartLine className="text-2xl" />
        <span className="text-sm">Predictions</span>
      </Link>
    </nav>
  );
};

export default Navbar;
