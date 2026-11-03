export class SiteError extends Error { constructor(status, message) { super(message); this.status = status } }
export const siteFields = ['name','profession','location','headline','subtitle','presentation','approach','signatureAbout','email','phone','heroMediaId','heroAlt','heroCredit','portraitMediaId','portraitAlt','portraitCredit','pdfMediaId','pdfDownloadName','services','socials']
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
function text(value, label, max, optional = false) {
  if (value == null && optional) return null
  if (typeof value !== 'string' || value.length > max || !optional && !value.trim()) throw new SiteError(400, `Vérifiez le champ « ${label} » (maximum ${max} caractères).`)
  return value.trim()
}
export function contactURLs(email, phone) {
  return { email: 'mailto:' + encodeURIComponent(email), quote: 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Demande de devis — Projet architectural'), whatsapp: 'https://wa.me/' + phone.replace(/\D/g, '') }
}
export function validateSite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !siteFields.includes(k))) throw new SiteError(400, 'Profil invalide ou champ non autorisé.')
  const d = { ...input }
  const required = { name: ['Nom',180], profession: ['Intitulé professionnel',180], location: ['Localisation',180], headline: ['Accroche',300], subtitle: ['Sous-titre',1000], presentation: ['Présentation',10000], approach: ['Démarche',10000], signatureAbout: ['Signature À propos',300], heroAlt: ['Texte alternatif du portrait d’accueil',1000], portraitAlt: ['Texte alternatif du portrait À propos',1000] }
  for (const [k, [label, max]] of Object.entries(required)) d[k] = text(d[k], label, max)
  for (const k of ['heroCredit','portraitCredit']) d[k] = text(d[k], 'Crédit',2000,true)
  for (const k of ['heroMediaId','portraitMediaId','pdfMediaId']) if (!uuid(d[k])) throw new SiteError(400, 'Choisissez deux portraits validés et un PDF validé.')
  d.email = text(d.email,'E-mail',254)
  if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(d.email) || d.email.includes('..')) throw new SiteError(400, 'Adresse e-mail invalide.')
  d.phone = text(d.phone,'Numéro WhatsApp',24)
  if (!/^\+?[0-9 ()-]{8,24}$/.test(d.phone) || !/^[1-9][0-9]{7,14}$/.test(d.phone.replace(/\D/g,''))) throw new SiteError(400, 'Renseignez le numéro WhatsApp avec son indicatif international.')
  if (typeof d.pdfDownloadName !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}\.pdf$/.test(d.pdfDownloadName)) throw new SiteError(400, 'Nom du PDF : lettres, chiffres, tirets, puis .pdf (105 caractères maximum).')
  if (!Array.isArray(d.services) || d.services.length > 20 || !Array.isArray(d.socials) || d.socials.length > 10) throw new SiteError(400, 'Maximum 20 services et 10 liens sociaux.')
  d.services = d.services.map(s => {
    if (!s || Object.keys(s).some(k => !['title','description','mediaId','alt','credit'].includes(k))) throw new SiteError(400, 'Service invalide.')
    if (s.mediaId != null && !uuid(s.mediaId)) throw new SiteError(400, 'Image de service invalide.')
    return { title: text(s.title,'Titre du service',180), description: text(s.description,'Description du service',5000), mediaId: s.mediaId ?? null, alt: text(s.alt,'Texte alternatif du service',1000,!s.mediaId), credit: text(s.credit,'Crédit',2000,true) }
  })
  d.socials = d.socials.map(s => {
    if (!s || Object.keys(s).some(k => !['label','url'].includes(k))) throw new SiteError(400, 'Lien social invalide.')
    const label = text(s.label,'Réseau social',80), value = text(s.url,'Lien social',500)
    let url; try { url = new URL(value) } catch { throw new SiteError(400, 'Adresse de réseau social invalide.') }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new SiteError(400, 'Les réseaux sociaux doivent utiliser une adresse HTTPS sans identifiants.')
    return { label, url: url.href }
  })
  return d
}
