import { Link } from 'react-router'
import { coverOf, numberOf, projectPath } from '../data/catalog'
import Arrow from './Arrow'
import MediaImage from './MediaImage'

export default function ProjectCard({ project, editorial = false }) {
  const image = coverOf(project)
  return (
    <article className={`project-card${editorial ? ' project-card--editorial' : ''}`}>
      <Link to={projectPath(project)} className="project-card__link" aria-label={`Découvrir ${project.title}`}>
        <div className="project-card__image">
          <MediaImage image={image} style={{ maxWidth: image.width }} sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 850px) 44vw, 33vw" />
          <span className="image-arrow"><Arrow /></span>
        </div>
        <div className="project-card__heading">
          <span className="project-number">{numberOf(project)}</span>
          <div><p className="eyebrow">{project.category}</p><h3>{project.title}</h3></div>
          <Arrow />
        </div>
      </Link>
      <p className="project-card__mission">{project.missionLabel}</p>
      {project.agency && <p className="credit">Pour {project.agency}</p>}
    </article>
  )
}
