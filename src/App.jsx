// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Feed from './pages/Feed'
import Home from './pages/Home'
import Profile from './pages/Profile'
import AddBook from './pages/AddBook'
import ReadingSession from './pages/ReadingSession'
import Admin from './pages/Admin'
import Register from './pages/Register'
import Stats from './pages/Stats'
import BookNotes from './pages/BookNotes'
import PublicProfile from './pages/PublicProfile'
import Biblioteca from './pages/Biblioteca'
import Descubrir from './pages/Descubrir'
import Onboarding from './pages/Onboarding'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/home" element={<Home />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add-book" element={<AddBook />} />
        <Route path="/reading/:id" element={<ReadingSession />} />
        <Route path="/notes/:id" element={<BookNotes />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/user/:id" element={<PublicProfile />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/descubrir" element={<Descubrir />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App