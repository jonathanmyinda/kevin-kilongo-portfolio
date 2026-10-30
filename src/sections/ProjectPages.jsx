import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { projects, filters, filterProjects, coverOf, projectPath, numberOf } from '../data/catalog'
import ProjectCard from '../components/ProjectCard'
import PageMeta from '../components/PageMeta'
import Arrow from '../components/Arrow'
import Lightbox from '../components/Lightbox'
import MediaImage from '../components/MediaImage'
import { Contact } from './HomeSections'

export function CatalogPage() {
  const [params, setParams] = useSearchParams()
  const selected = filters.some((filter) => filter.id === params.get('categorie')) ? params.get('categorie') : 'tous'
  const visibleProjects = filterProjects(selected)
  return <main id="main-content" tabIndex={-1}>
    <PageMeta title="Projets" description="Projets de Kevin Kilongo Munganga : conception architecturale, contributions en agence et visualisation 3D." />
    <section className="catalog shell section" aria-labelledby="catalog-title"><div className="catalog-header"><div><p className="eyebrow">Index des projets / 01—18</p><h1 id="catalog-title">Espaces &<br /><em>perspectives.</em></h1></div><p>Conception architecturale,<br />contributions en agence et visualisation 3D.</p></div>
      <div className="catalog-toolbar"><div className="filters" role="group" aria-label="Filtrer les projets par programme">{filters.map((filter) => <button key={filter.id} type="button" aria-pressed={selected === filter.id} onClick={() => setParams(filter.id === 'tous' ? {} : { categorie: filter.id }, { preventScrollReset: true })}>{filter.label}<span>{filterProjects(filter.id).length.toString().padStart(2, '0')}</span></button>)}</div><p role="status" aria-live="polite" className="result-count">{visibleProjects.length} projets</p></div>
      <div key={selected} className="catalog-grid filter-results">{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
    </section><Contact compact />
  </main>
}

function ProjectGallery({ project }) {
  const [viewer, setViewer] = useState(null)
  const cover = coverOf(project)
  const gallery = project.images.filter((image) => image.src !== cover.src)
  function open(image, event) { setViewer({ index: project.images.findIndex((item) => item.src === image.src), trigger: event.currentTarget }) }
  return <>
    <figure className="project-main-image" style={{ maxWidth: cover.width }}><button type="button" className="image-button" aria-label={`Agrandir : ${cover.alt}`} onClick={(event) => open(cover, event)}><MediaImage image={cover} eager sizes="(max-width: 600px) calc(100vw - 40px), 85vw" /><span className="enlarge-label">Agrandir <span aria-hidden="true">＋</span></span></button><figcaption>{cover.alt.replace(`${project.title} — `, '')}{project.agency && <span>Pour {project.agency}</span>}</figcaption></figure>
    {gallery.length > 0 && <section className="gallery-section" aria-labelledby="gallery-title"><div className="gallery-heading"><h2 id="gallery-title">Le projet en images</h2><span className="eyebrow">{project.images.length} visuels · Rendus & dessins</span></div><div className="gallery-grid">{gallery.map((image) => <figure key={image.src} className={image.kind === 'drawing' ? 'gallery-item gallery-item--drawing' : 'gallery-item'}><button type="button" className="image-button" style={{ maxWidth: image.width }} aria-label={`Agrandir : ${image.alt}`} onClick={(event) => open(image, event)}><MediaImage image={image} /><span className="enlarge-label">Agrandir <span aria-hidden="true">＋</span></span></button><figcaption>{image.alt.replace(`${project.title} — `, '')}{image.credit && <span>Pour {image.credit}</span>}</figcaption></figure>)}</div></section>}
    {viewer && <Lightbox images={project.images} initialIndex={viewer.index} trigger={viewer.trigger} onClose={() => setViewer(null)} />}
  </>
}

export function ProjectPage() {
  const { slug } = useParams()
  const project = projects.find((item) => item.slug === slug)
  if (!project) return <NotFoundPage />
  const index = projects.indexOf(project)
  const previous = projects[(index - 1 + projects.length) % projects.length]
  const next = projects[(index + 1) % projects.length]
  return <main id="main-content" tabIndex={-1}>
    <PageMeta title={project.title} description={project.publicDescription || project.description} />
    <article className="project-detail shell section"><Link to="/projets" className="text-link back-link"><Arrow direction="left" /> Tous les projets</Link><div className="project-title-block"><p className="eyebrow">Projet {numberOf(project)} / {project.category}</p><h1>{project.title}</h1><p className="mission-tag">{project.missionLabel}</p></div>
      <div className="project-overview"><p className="project-description">{project.publicDescription || project.description}</p><dl className="project-facts"><div className="project-fact--mission"><dt>Ma mission</dt><dd>{project.publicRole}</dd></div>{project.agency && <div><dt>Pour le compte de</dt><dd>{project.agency}</dd></div>}{project.context && !project.context.startsWith('Section II') && <div><dt>Cadre</dt><dd>{project.context}</dd></div>}{project.location && <div><dt>Localisation</dt><dd>{project.location}</dd></div>}{project.year && <div><dt>Année</dt><dd>{project.year}</dd></div>}{project.phase && <div><dt>Phase</dt><dd>{project.phase}</dd></div>}{project.tools.length > 0 && <div><dt>Outils du projet</dt><dd>{project.tools.map((tool) => <span className="tool-line" key={tool.name}>{tool.name}{tool.usage && <small> / {tool.usage}</small>}</span>)}</dd></div>}</dl></div>
      <ProjectGallery key={project.slug} project={project} />
      {project.typologies && <section className="typologies" aria-labelledby="typologies-title"><h2 id="typologies-title">Les typologies résidentielles</h2><div>{project.typologies.filter((item) => item.areaSqm).map((item) => <p key={item.name}><span>{item.name}</span><strong>{item.areaSqm.toLocaleString('fr-FR')} m²</strong></p>)}</div></section>}
      <nav className="project-pagination" aria-label="Parcourir les projets"><Link to={projectPath(previous)}><span className="eyebrow"><Arrow direction="left" /> Projet précédent</span><span>{previous.title}</span></Link><Link to={projectPath(next)}><span className="eyebrow">Projet suivant <Arrow direction="right" /></span><span>{next.title}</span></Link></nav>
    </article><Contact compact />
  </main>
}

export function NotFoundPage() {
  return <main id="main-content" className="not-found shell section" tabIndex={-1}><PageMeta title="Page introuvable" description="Cette page n’existe pas. Retrouvez les projets de Kevin Kilongo Munganga ou revenez à l’accueil." /><p className="eyebrow">404 / Page introuvable</p><h1>Une autre<br /><em>perspective ?</em></h1><p>Cette adresse ne correspond à aucune page du portfolio.<br />Consultez les projets ou revenez à l’accueil.</p><div className="not-found-actions"><Link to="/projets" className="button">Découvrir les projets <Arrow /></Link><Link to="/" className="text-link">Revenir à l’accueil <Arrow direction="right" /></Link></div></main>
}


