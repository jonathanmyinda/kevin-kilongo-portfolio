import { useState } from 'react'
import { Link } from 'react-router'
import {projectPath,periodOf} from '../data/catalog'
import {useContent} from '../data/content-context'
import Arrow from '../components/Arrow'
import ProjectCard from '../components/ProjectCard'
import MediaImage from '../components/MediaImage'
import Lightbox from '../components/Lightbox'
import { DownloadLink } from '../components/Layout'

function Signature({value,fallback}){const text=value||fallback,separator=text.includes(':')?':':',',i=text.indexOf(separator);return i<0?text:<>{text.slice(0,i+1)}<br/><em>{text.slice(i+1).trim()}</em></>}

export function Hero() {
  const {profile,contactLinks}=useContent()
  return <section className="hero shell" aria-labelledby="hero-title">
    <div className="hero-stage">
      <figure className="hero-portrait"><MediaImage image={profile.heroPortrait} eager sizes="(max-width: 700px) calc(100vw - 40px), 68vw" /><figcaption>{profile.name} · {profile.profession}</figcaption></figure>
      <div className="hero-copy"><p className="eyebrow">{profile.profession} — {profile.location}</p><h1 id="hero-title"><Signature value={profile.headline} fallback="Architecture de sens, héritage en mouvement"/></h1><p className="hero-description">{profile.subtitle||'Je conçois des espaces, réalise des rendus 3D et accompagne le suivi des travaux.'}</p><p className="hero-person">{profile.name}</p><div className="hero-actions"><Link className="button" to="/projets">Découvrir mes projets <Arrow /></Link><a className="text-link" href={contactLinks.quote}>Demander un devis <Arrow direction="right" /></a></div></div>
    </div>
    <div className="hero-bottom"><span>{profile.location.split(',')[0]} / Conception / Visualisation / Chantier</span><a href="#selection" className="text-link">Explorer les projets <Arrow direction="down" /></a></div>
  </section>
}

export function SelectedProjects() {
  const {featuredProjects}=useContent()
  return <section className="selection section shell" id="selection" tabIndex={-1} aria-labelledby="selection-title">
    <div className="section-heading"><p className="eyebrow"><span>01 /</span> Projets sélectionnés</p><h2 id="selection-title">Des lieux.<br /><em>Des intentions.</em></h2><p className="section-intro">Habitat, urbanisme, santé, restauration et sport.</p></div>
    <div className="editorial-grid">{featuredProjects.map((project) => <ProjectCard key={project.id} project={project} editorial />)}</div>
    <div className="section-end"><span className="muted">Travaux en agence, en consultance et en nom propre.</span><Link className="button button--outline" to="/projets">Voir tous les projets <Arrow direction="right" /></Link></div>
  </section>
}

export function Expertises() {
  const {services:expertises}=useContent()
  return <section className="expertise-band" id="expertises" tabIndex={-1} aria-labelledby="expertises-title"><div className="shell section"><div className="services-heading"><div><p className="eyebrow"><span>02 /</span> Services</p><h2 id="expertises-title">Penser les espaces.<br /><em>Accompagner les projets.</em></h2></div><p>Études, plans, rendus et suivi de travaux.</p></div><div className="services-grid">{expertises.map((item, index) => <article key={item.title} className={item.image ? 'service-card service-card--photo' : 'service-card'}><div className="service-copy"><span className="project-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></div>{item.image && <figure><MediaImage image={item.image} sizes="(max-width: 600px) 45vw, 22vw" /></figure>}</article>)}</div><Link to="/#contact" className="text-link service-contact">Échanger sur votre projet <Arrow /></Link></div></section>
}

export function Perspectives() {
  const {perspectives}=useContent()
  const [viewer, setViewer] = useState(null)
  const images = perspectives.map((item) => item.image)
  return <section className="perspectives section shell" id="perspectives" tabIndex={-1} aria-labelledby="perspectives-title"><div className="section-heading"><p className="eyebrow"><span>03 /</span> Perspectives</p><h2 id="perspectives-title">Volumes, lumière<br /><em>et matières.</em></h2><p className="section-intro">Rendus d’architecture intérieure, de logements et d’hôtellerie.</p></div><div className="perspectives-grid">{perspectives.map((item, index) => <figure className="perspective-item" key={item.projectId}><button type="button" className="image-button" aria-label={`Agrandir : ${item.image.alt}`} onClick={(event) => setViewer({ index, trigger: event.currentTarget })}><MediaImage image={item.image} sizes="(max-width: 600px) calc(100vw - 40px), 45vw" /><span className="enlarge-label">Agrandir <span aria-hidden="true">＋</span></span></button><figcaption><Link to={projectPath(item.project)}>{item.project.title}<Arrow /></Link><span>{item.project.missionLabel}{item.project.agency && ` · ${item.project.agency}`}</span></figcaption></figure>)}</div>{viewer && <Lightbox images={images} initialIndex={viewer.index} trigger={viewer.trigger} onClose={() => setViewer(null)} />}</section>
}

export function About() {
  const {profile}=useContent()
  return <section className="about section shell" id="a-propos" tabIndex={-1} aria-labelledby="about-title">
    <p className="eyebrow"><span>04 /</span> À propos</p>
    <div className="about-intro"><div className="portrait-column"><figure className="portrait"><MediaImage image={profile.portrait} sizes="(max-width: 600px) 150px, 280px" /><figcaption>{profile.name}<span>{profile.profession} · {profile.location.split(',')[0]}</span></figcaption></figure></div><div className="about-copy"><h2 id="about-title"><Signature value={profile.signatureAbout} fallback="Patrimoine & modernité : une même architecture"/></h2><p className="lead">{profile.approach||'Ancré à Kinshasa, je cherche un dialogue entre l’héritage des lieux et leurs usages à venir. La mémoire, les matériaux et la lumière nourrissent une démarche qui associe rigueur technique et créativité.'}</p><p className="about-facts">{profile.presentation||'Diplômé de l’ISAU en 2024, j’interviens en conception, coordination, visualisation et suivi de chantier. Ma formation en passation des marchés complète cette pratique par la gestion des appels d’offres et le suivi contractuel.'}</p><div className="education">{profile.education.map((item) => <p key={item.qualification}><strong>{item.qualification}{item.year ? ` · ${item.year}` : ''}</strong><span>{item.institution}</span></p>)}</div><DownloadLink className="button button--outline" /></div></div>
    <div className="about-detail"><div className="experience"><h3 className="subheading">Parcours professionnel</h3><div className="experience-list">{profile.experiences.map((item) => <article key={item.organization}><p className="experience-date">{periodOf(item)}</p><div><h4>{item.organization}</h4><p className="experience-role">{item.title}</p><p>{item.description}</p></div></article>)}</div><details className="internships"><summary>Stages académiques <span aria-hidden="true">+</span></summary>{profile.internships.map((item) => <p key={item.organization}><span>{periodOf(item)}</span>{item.organization}</p>)}</details></div><aside className="software" aria-labelledby="software-title"><h3 className="subheading" id="software-title">Outils & méthodes</h3>{profile.software.map((group) => <div className="software-group" key={group.category}><h4>{group.category}</h4><p>{group.tools.join(' · ')}</p></div>)}<div className="software-group"><h4>Langues</h4><p>{profile.languages.join(' · ')}</p></div></aside></div>
  </section>
}

export function Contact({ compact = false }) {
  const {profile,contactLinks}=useContent()
  return <section className={`contact-band${compact ? ' contact-band--compact' : ''}`} id="contact" tabIndex={-1} aria-labelledby="contact-title"><div className="shell section"><p className="eyebrow"><span>{compact ? 'Contact' : '05 / Contact'}</span> {profile.location}</p><div className="contact-heading"><h2 id="contact-title">Votre prochain projet<br /><em>commence ici.</em></h2><p>Présentez-moi votre projet.<br />Nous pourrons en discuter.</p></div><div className="contact-links"><a className="contact-email" href={contactLinks.email}>{profile.contact.email}<Arrow /></a><div className="contact-secondary"><a href={contactLinks.phone} aria-label={`Contacter ${profile.name} sur WhatsApp au ${profile.contact.phone}`}>{profile.contact.phone}<Arrow /></a><a href={contactLinks.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Demander un rendez-vous via WhatsApp, nouvel onglet">Demander un rendez-vous <Arrow /></a></div></div><nav className="social-links" aria-label="Réseaux sociaux">{profile.socials.map((social) => <a key={social.network} href={social.url} target="_blank" rel="noopener noreferrer" aria-label={`${social.network} de ${profile.name}, nouvel onglet`}>{social.network}<Arrow /></a>)}</nav></div></section>
}
