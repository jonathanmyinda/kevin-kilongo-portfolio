import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from './components/Layout'
import PageMeta from './components/PageMeta'
import { Hero, SelectedProjects, Expertises, Perspectives, About, Contact } from './sections/HomeSections'
import { CatalogPage, ProjectPage, NotFoundPage } from './sections/ProjectPages'

function HomePage() {
  return <main id="main-content" tabIndex={-1}><PageMeta title="Portfolio" description="Kevin Kilongo Munganga, architecte à Kinshasa : conception architecturale, visualisation 3D, coordination et suivi de chantier." /><Hero /><SelectedProjects /><Expertises /><Perspectives /><About /><Contact /></main>
}

export function PortfolioRoutes() {
  return <Routes><Route element={<Layout />}><Route index element={<HomePage />} /><Route path="projets" element={<CatalogPage />} /><Route path="projets/:slug" element={<ProjectPage />} /><Route path="*" element={<NotFoundPage />} /></Route></Routes>
}

function App() {
  return <BrowserRouter><PortfolioRoutes /></BrowserRouter>
}

export default App
