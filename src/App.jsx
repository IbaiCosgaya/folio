import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import Profile from './pages/Profile'
import AddBook from './pages/AddBook'
import ReadingSession from './pages/ReadingSession'
import Admin from './pages/Admin'
import Register from './pages/Register'
import Stats from './pages/Stats'
import BookNotes from './pages/BookNotes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add-book" element={<AddBook />} />
        <Route path="/reading/:id" element={<ReadingSession />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/notes/:id" element={<BookNotes />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App