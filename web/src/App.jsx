import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Spinner from './components/Spinner'
import Login from './pages/Login'
import NotAuthorized from './pages/NotAuthorized'
import Home from './pages/Home'
import ClientList from './pages/ClientList'
import ClientDetail from './pages/ClientDetail'
import InstructionDetail from './pages/InstructionDetail'
import NewInstruction from './pages/NewInstruction'

function Gate() {
  const { loading, session, allowed } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-navy">
        <Spinner label="Loading…" />
      </div>
    )
  }
  if (!session) return <Login />
  if (!allowed) return <NotAuthorized />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/clients" element={<ClientList />} />
        <Route path="/client/:id" element={<ClientDetail />} />
        <Route path="/instruction/:id" element={<InstructionDetail />} />
        <Route path="/new" element={<NewInstruction />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
