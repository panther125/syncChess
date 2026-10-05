import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Game from './pages/Game'
import Rules from './pages/Rules'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game" element={<Game />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
