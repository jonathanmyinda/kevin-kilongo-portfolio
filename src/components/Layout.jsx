import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { profile, pdfSize, contactLinks } from '../data/catalog'
import Arrow from './Arrow'
import MotionEnhancements from './MotionEnhancements'

export function DownloadLink({ className = 'text-link' }) {
  return <a className={className} href={profile.portfolio.src} download={profile.portfolio.downloadName}>Télécharger le portfolio <span className="download-weight">PDF · {pdfSize}</span><Arrow direction="down" /></a>
}

function Header() {
  const location = useLocation()
  const [openLocation, setOpenLocation] = useState(null)
  const open = openLocation === location.key
  const setOpen = (value) => setOpenLocation(value ? location.key : null)
  const menuButton = useRef(null)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 850px)')
    const update = () => { setMobile(query.matches); if (!query.matches) setOpenLocation(null) }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const sectionActive = (hash) => location.pathname === '/' && location.hash === hash
  const close = () => setOpen(false)
  return (
    <header className="site-header" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { close(); menuButton.current.focus() }
    }}>
      <div className="header-inner shell">
        <Link to="/" className="identity" onClick={close} aria-label="Kevin Kilongo — accueil"><span>Kevin Kilongo<span className="identity-dot">.</span></span><span className="identity-subtitle">Architecte</span></Link>
        <button ref={menuButton} className="menu-toggle" type="button" aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? 'Fermer' : 'Menu'}<span aria-hidden="true">{open ? '×' : '+'}</span></button>
        <nav id="main-navigation" className={open ? 'main-nav is-open' : 'main-nav'} inert={mobile && !open} aria-label="Navigation principale">
          <NavLink to="/projets" onClick={close}>Projets</NavLink>
          <Link to="/#perspectives" aria-current={sectionActive('#perspectives') ? 'location' : undefined} onClick={close}>Perspectives</Link>
          <Link to="/#expertises" aria-current={sectionActive('#expertises') ? 'location' : undefined} onClick={close}>Services</Link>
          <Link to="/#a-propos" aria-current={sectionActive('#a-propos') ? 'location' : undefined} onClick={close}>À propos</Link>
          <Link to="/#contact" aria-current={sectionActive('#contact') ? 'location' : undefined} onClick={close}>Contact</Link>
          <a href={contactLinks.quote} className="header-cta" onClick={close}>Demander un devis <Arrow /></a>
        </nav>
      </div>
    </header>
  )
}

function RouteFocus() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let anchor = hash.slice(1)
      try { anchor = decodeURIComponent(anchor) } catch { /* Keep malformed fragments harmless. */ }
      const target = hash ? document.getElementById(anchor) : document.getElementById('main-content')
      if (target) {
        target.focus({ preventScroll: true })
        if (hash) target.scrollIntoView({ block: 'start' })
        else window.scrollTo({ top: 0, behavior: 'instant' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
  return null
}

export default function Layout() {
  return <>
    <a href="#main-content" className="skip-link">Aller au contenu</a>
    <RouteFocus />
    <MotionEnhancements />
    <Header />
    <Outlet />
    <footer className="site-footer shell">
      <Link to="/" className="footer-name">Kevin Kilongo Munganga<span>Architecte · Kinshasa, RDC</span></Link>
      <DownloadLink />
      <span className="footer-note">Portfolio d’architecture</span>
    </footer>
  </>
}
