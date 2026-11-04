import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from './components/Layout'
import {ContentProvider} from './data/ContentProvider'
import PageMeta from './components/PageMeta'
import { Hero, SelectedProjects, Expertises, Perspectives, About, Contact } from './sections/HomeSections'
import { CatalogPage, ProjectPage, NotFoundPage } from './sections/ProjectPages'
import { lazy, Suspense } from 'react'
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

function HomePage() {
  return <main id="main-content" tabIndex={-1}><PageMeta title="Portfolio" description="Kevin Kilongo Munganga, architecte à Kinshasa : conception architecturale, visualisation 3D, coordination et suivi de chantier." /><Hero /><SelectedProjects /><Expertises /><Perspectives /><About /><Contact /></main>
}

export function PortfolioRoutes({initialContent}) {
  return <Routes><Route path="/admin/*" element={<Suspense fallback={<main>Chargement de l’administration…</main>}><AdminDashboard /></Suspense>} /><Route element={<ContentProvider initialContent={initialContent}><Layout /></ContentProvider>}><Route index element={<HomePage />} /><Route path="projets" element={<CatalogPage />} /><Route path="projets/:slug" element={<ProjectPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes>
}

function App() {
  return <BrowserRouter><PortfolioRoutes /></BrowserRouter>
}

export default App
