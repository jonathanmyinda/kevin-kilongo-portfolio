import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

// Visible HTML is the baseline. Only intersecting elements receive an animation;
// no pending/hidden class, readiness flag or completion event is required.
export default function MotionEnhancements() {
  const { pathname } = useLocation()
  const seen = useRef(new WeakSet())
  useEffect(() => {
    let observer
    let resize
    try {
      const header = document.querySelector('.site-header')
      const measure = () => document.documentElement.style.setProperty('--header-height', `${header?.getBoundingClientRect().height || 82}px`)
      measure()
      resize = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
      if (header) resize?.observe(header)
      const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: true }
      if (!preference.matches && typeof IntersectionObserver === 'function') {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            observer.unobserve(entry.target)
            if (seen.current.has(entry.target) || preference.matches) continue
            seen.current.add(entry.target)
            const siblings = Array.from(entry.target.parentElement.children)
            const index = siblings.indexOf(entry.target)
            entry.target.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 45}ms`)
            entry.target.classList.add('reveal-enter')
          }
        }, { threshold: 0.06, rootMargin: '0px 0px -24px 0px' })
        document.querySelectorAll('.section-heading, .editorial-grid > article, .services-heading, .services-grid > article, .perspectives-grid > figure, .about-intro, .about-detail > *, .contact-heading, .contact-links, .gallery-heading, .gallery-grid > figure').forEach((element) => observer.observe(element))
      }
    } catch {
      observer?.disconnect() // Failed enhancement leaves ordinary visible content.
      resize?.disconnect()
    }
    return () => { observer?.disconnect(); resize?.disconnect() }
  }, [pathname])
  return null
}
