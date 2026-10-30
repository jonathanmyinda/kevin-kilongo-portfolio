import { useState } from 'react'
import { Link } from 'react-router'
import { profile, featuredProjects, contactLinks, projectPath, periodOf, serviceImages, perspectives } from '../data/catalog'
import Arrow from '../components/Arrow'
import ProjectCard from '../components/ProjectCard'
import MediaImage from '../components/MediaImage'
import Lightbox from '../components/Lightbox'
import { DownloadLink } from '../components/Layout'

export function Hero() {
  return <section className="hero shell" aria-labelledby="hero-title">
    <div className="hero-stage">
      <figure className="hero-portrait"><MediaImage image={profile.heroPortrait} eager sizes="(max-width: 700px) calc(100vw - 40px), 68vw" /><figcaption>Kevin Kilongo Munganga · Architecte</figcaption></figure>
      <div className="hero-copy"><p className="eyebrow">Architecte — Kinshasa, RDC</p><h1 id="hero-title">Architecture de sens,<br /><em>héritage en mouvement</em></h1><p className="hero-description">Je conçois des espaces, réalise des rendus 3D et accompagne le suivi des travaux.</p><p className="hero-person">Kevin Kilongo Munganga</p><div className="hero-actions"><Link className="button" to="/projets">Découvrir mes projets <Arrow /></Link><a className="text-link" href={contactLinks.quote}>Demander un devis <Arrow direction="right" /></a></div></div>
    </div>
    <div className="hero-bottom"><span>Kinshasa / Conception / Visualisation / Chantier</span><a href="#selection" className="text-link">Explorer les projets <Arrow direction="down" /></a></div>
  </section>
}

export function SelectedProjects() {
  return <section className="selection section shell" id="selection" tabIndex={-1} aria-labelledby="selection-title">
    <div className="section-heading"><p className="eyebrow"><span>01 /</span> Projets sélectionnés</p><h2 id="selection-title">Des lieux.<br /><em>Des intentions.</em></h2><p className="section-intro">Habitat, urbanisme, santé, restauration et sport.</p></div>
    <div className="editorial-grid">{featuredProjects.map((project) => <ProjectCard key={project.id} project={project} editorial />)}</div>
    <div className="section-end"><span className="muted">Travaux en agence, en consultance et en nom propre.</span><Link className="button button--outline" to="/projets">Voir tous les projets <Arrow direction="right" /></Link></div>
  </section>
}

const expertises = [
  { title: 'Conception architecturale', text: 'Je prépare les études préliminaires et les plans d’avant-projet. J’organise les espaces, les volumes et la lumière en tenant compte des usages et des contraintes techniques.' },
  { title: 'Suivi de projet et coordination', text: 'Je coordonne les échanges et le suivi des travaux. Je contrôle la conformité aux plans et aux spécifications, puis je rédige les rapports et les documents techniques.', imageKey: 'suivi' },
  { title: 'Conseil et faisabilité', text: 'J’étudie la faisabilité et les choix techniques du projet. J’accompagne les décisions sur les matériaux, les orientations budgétaires et le phasage.', imageKey: 'conseil' },
  { title: 'Modélisation et visualisation 3D', text: 'Je modélise les volumes et réalise des rendus 3D. Je travaille les matières, la lumière et la post-production pour présenter les espaces.' },
]

export function Expertises() {
  return <section className="expertise-band" id="expertises" tabIndex={-1} aria-labelledby="expertises-title"><div className="shell section"><div className="services-heading"><div><p className="eyebrow"><span>02 /</span> Services</p><h2 id="expertises-title">Penser les espaces.<br /><em>Accompagner les projets.</em></h2></div><p>Études, plans, rendus et suivi de travaux.</p></div><div className="services-grid">{expertises.map((item, index) => <article key={item.title} className={item.imageKey ? 'service-card service-card--photo' : 'service-card'}><div className="service-copy"><span className="project-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></div>{item.imageKey && <figure><MediaImage image={serviceImages[item.imageKey]} sizes="(max-width: 600px) 45vw, 22vw" /></figure>}</article>)}</div><Link to="/#contact" className="text-link service-contact">Échanger sur votre projet <Arrow /></Link></div></section>
}

export function Perspectives() {
  const [viewer, setViewer] = useState(null)
  const images = perspectives.map((item) => item.image)
  return <section className="perspectives section shell" id="perspectives" tabIndex={-1} aria-labelledby="perspectives-title"><div className="section-heading"><p className="eyebrow"><span>03 /</span> Perspectives</p><h2 id="perspectives-title">Volumes, lumière<br /><em>et matières.</em></h2><p className="section-intro">Rendus d’architecture intérieure, de logements et d’hôtellerie.</p></div><div className="perspectives-grid">{perspectives.map((item, index) => <figure className="perspective-item" key={item.projectId}><button type="button" className="image-button" aria-label={`Agrandir : ${item.image.alt}`} onClick={(event) => setViewer({ index, trigger: event.currentTarget })}><MediaImage image={item.image} sizes="(max-width: 600px) calc(100vw - 40px), 45vw" /><span className="enlarge-label">Agrandir <span aria-hidden="true">＋</span></span></button><figcaption><Link to={projectPath(item.project)}>{item.project.title}<Arrow /></Link><span>{item.project.missionLabel}{item.project.agency && ` · ${item.project.agency}`}</span></figcaption></figure>)}</div>{viewer && <Lightbox images={images} initialIndex={viewer.index} trigger={viewer.trigger} onClose={() => setViewer(null)} />}</section>
}

export function About() {
  return <section className="about section shell" id="a-propos" tabIndex={-1} aria-labelledby="about-title">
    <p className="eyebrow"><span>04 /</span> À propos</p>
    <div className="about-intro"><div className="portrait-column"><figure className="portrait"><MediaImage image={profile.portrait} sizes="(max-width: 600px) 150px, 280px" /><figcaption>Kevin Kilongo Munganga<span>Architecte · Kinshasa</span></figcaption></figure></div><div className="about-copy"><h2 id="about-title">Patrimoine & modernité :<br /><em>une même architecture</em></h2><p className="lead">Ancré à Kinshasa, je cherche un dialogue entre l’héritage des lieux et leurs usages à venir. La mémoire, les matériaux et la lumière nourrissent une démarche qui associe rigueur technique et créativité.</p><p className="about-facts">Diplômé de l’ISAU en 2024, j’interviens en conception, coordination, visualisation et suivi de chantier. Ma formation en passation des marchés complète cette pratique par la gestion des appels d’offres et le suivi contractuel.</p><div className="education">{profile.education.map((item) => <p key={item.qualification}><strong>{item.qualification}{item.year ? ` · ${item.year}` : ''}</strong><span>{item.institution}</span></p>)}</div><DownloadLink className="button button--outline" /></div></div>
    <div className="about-detail"><div className="experience"><h3 className="subheading">Parcours professionnel</h3><div className="experience-list">{profile.experiences.map((item) => <article key={item.organization}><p className="experience-date">{periodOf(item)}</p><div><h4>{item.organization}</h4><p className="experience-role">{item.title}</p><p>{item.description}</p></div></article>)}</div><details className="internships"><summary>Stages académiques <span aria-hidden="true">+</span></summary>{profile.internships.map((item) => <p key={item.organization}><span>{periodOf(item)}</span>{item.organization}</p>)}</details></div><aside className="software" aria-labelledby="software-title"><h3 className="subheading" id="software-title">Outils & méthodes</h3>{profile.software.map((group) => <div className="software-group" key={group.category}><h4>{group.category}</h4><p>{group.tools.join(' · ')}</p></div>)}<div className="software-group"><h4>Langues</h4><p>{profile.languages.join(' · ')}</p></div></aside></div>
  </section>
}

export function Contact({ compact = false }) {
  return <section className={`contact-band${compact ? ' contact-band--compact' : ''}`} id="contact" tabIndex={-1} aria-labelledby="contact-title"><div className="shell section"><p className="eyebrow"><span>{compact ? 'Contact' : '05 / Contact'}</span> {profile.location}</p><div className="contact-heading"><h2 id="contact-title">Votre prochain projet<br /><em>commence ici.</em></h2><p>Présentez-moi votre projet.<br />Nous pourrons en discuter.</p></div><div className="contact-links"><a className="contact-email" href={contactLinks.email}>{profile.contact.email}<Arrow /></a><div className="contact-secondary"><a href={contactLinks.phone} aria-label={`Contacter Kevin Kilongo sur WhatsApp au ${profile.contact.phone}`}>{profile.contact.phone}<Arrow /></a><a href={contactLinks.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Demander un rendez-vous via WhatsApp, nouvel onglet">Demander un rendez-vous <Arrow /></a></div></div><nav className="social-links" aria-label="Réseaux sociaux">{profile.socials.map((social) => <a key={social.network} href={social.url} target="_blank" rel="noopener noreferrer" aria-label={`${social.network} de Kevin Kilongo, nouvel onglet`}>{social.network}<Arrow /></a>)}</nav></div></section>
}
