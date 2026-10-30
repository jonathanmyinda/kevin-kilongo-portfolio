export const contactFields = [
  { name: 'name', label: 'Nom', type: 'text', autoComplete: 'name', required: true, minLength: 2, maxLength: 100 },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email', required: true, maxLength: 254 },
  { name: 'phone', label: 'Téléphone', type: 'tel', autoComplete: 'tel', required: false, maxLength: 40 },
  { name: 'subject', label: 'Objet', type: 'text', required: true, minLength: 3, maxLength: 150 },
  { name: 'message', label: 'Message', required: true, minLength: 10, maxLength: 5000 },
]

export const emptyContact = () => ({ name: '', email: '', phone: '', subject: '', message: '', _gotcha: '' })

export function validateContact(values) {
  const errors = {}
  for (const field of contactFields) {
    const value = (values[field.name] ?? '').trim()
    if (field.required && !value) errors[field.name] = 'Ce champ est obligatoire.'
    else if (value && field.minLength && value.length < field.minLength) errors[field.name] = `Saisissez au moins ${field.minLength} caractères.`
    else if (value.length > field.maxLength) errors[field.name] = `Limitez ce champ à ${field.maxLength} caractères.`
    else if (field.type === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\r\n]/.test(value))) errors[field.name] = 'Saisissez une adresse e-mail valide.'
    else if (field.name !== 'message' && (/[\r\n]/.test(value) || value.includes('\0'))) errors[field.name] = 'Saisissez ce champ sur une seule ligne.'
  }
  return errors
}

// Public form identifier only. Never put an API key in VITE_*.
export function contactEndpoint(formId, serviceReady) {
  return serviceReady === 'true' && /^[a-zA-Z0-9]{8,32}$/.test(formId ?? '')
    ? `https://formspree.io/f/${formId}` : null
}

export class ContactError extends Error {
  constructor(message, fields = {}) {
    super(message)
    this.fields = fields
  }
}

export async function sendContact(values, endpoint, fetchImpl = globalThis.fetch) {
  const errors = validateContact(values)
  if (Object.keys(errors).length) throw new ContactError('Vérifiez les champs indiqués.', errors)
  if (!endpoint || !/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]{8,32}$/.test(endpoint)) throw new ContactError('Le formulaire n’est pas encore disponible. Contactez-moi par e-mail ou sur WhatsApp.')
  if (values._gotcha) throw new ContactError('Impossible de transmettre cette demande. Contactez-moi directement si le problème persiste.')
  const body = Object.fromEntries([...contactFields.map(({ name }) => [name, values[name].trim()]), ['_gotcha', '']])
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal, credentials: 'omit', redirect: 'error',
    })
    if (response.status === 429) throw new ContactError('Trop de demandes ont été envoyées. Patientez quelques minutes avant de réessayer.')
    const result = await response.json()
    if (!response.ok || result.ok !== true || result.errors?.length) {
      throw new ContactError('L’envoi n’a pas été accepté. Vérifiez les champs, puis réessayez ou contactez-moi directement.')
    }
  } catch (error) {
    if (error instanceof ContactError) throw error
    throw new ContactError('Impossible de confirmer l’envoi. Votre texte est conservé. Réessayez ou contactez-moi directement.')
  } finally {
    clearTimeout(timeout)
  }
}
