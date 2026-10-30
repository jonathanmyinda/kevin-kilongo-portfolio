import sourceProjects from './projects.json'
import sourceProfile from './profile.json'
import media from './published-media.json'
import selection from './homepage-selection.json'

export const projects = sourceProjects.map((project) => ({ ...project, ...media.projects[project.id] }))
export const profile = { ...sourceProfile, portrait: media.portrait, heroPortrait: media.heroPortrait, socials: [
  { network: 'LinkedIn', url: 'https://www.linkedin.com/in/kevin-kilongo-778a543a0' },
  { network: 'Instagram', url: 'https://www.instagram.com/kilongokevin/' },
] }
export const serviceImages = media.services
export const perspectives = media.perspectives.map((item) => ({ ...item, project: projects.find((project) => project.id === item.projectId) }))
export const featuredProjects = selection.map(({ projectId }) => projects.find((p) => p.id === projectId))
export const projectPath = (project) => `/projets/${project.slug}`
export const coverOf = (project) => project.images.find((image) => image.src === project.coverImage)
export const numberOf = (project) => String(project.number).padStart(2, '0')
export const filters = [
  { id: 'tous', label: 'Tous les projets', categories: [] },
  { id: 'habitat', label: 'Habitat & urbanisme', categories: ['Urbanisme résidentiel', 'Habitat collectif', 'Commerces et habitat', 'Habitat'] },
  { id: 'interieurs', label: 'Intérieurs & restauration', categories: ['Architecture intérieure', 'Restauration', 'Restauration et intérieur'] },
  { id: 'equipements', label: 'Équipements & hôtellerie', categories: ['Santé', 'Hôtellerie', 'Sport'] },
]
export function filterProjects(id) {
  const filter = filters.find((item) => item.id === id) || filters[0]
  return filter.id === 'tous' ? projects : projects.filter((p) => filter.categories.includes(p.category))
}
export const contactLinks = {
  email: `mailto:${profile.contact.email}`,
  phone: `tel:${profile.contact.phone.replaceAll(' ', '')}`,
  whatsapp: 'https://wa.me/message/6SE5RNJA3PEJM1',
}
export const pdfSize = `${(profile.portfolio.bytes / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo`
export function periodOf(experience) {
  const format = (value) => new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
  return experience.end ? `${format(experience.start)} — ${format(experience.end)}` : format(experience.start)
}
