import { useId, useRef, useState } from 'react'
import { contactEndpoint, contactFields, emptyContact, sendContact, validateContact } from '../data/contact'

const endpoint = contactEndpoint(import.meta.env.VITE_FORMSPREE_FORM_ID, import.meta.env.VITE_CONTACT_SERVICE_READY)

export default function ContactForm() {
  const id = useId()
  const lock = useRef(false)
  const formRef = useRef(null)
  const [values, setValues] = useState(emptyContact)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ kind: 'idle', text: '' })
  const sending = status.kind === 'sending'

  function focusField(fieldErrors) {
    formRef.current?.elements.namedItem(Object.keys(fieldErrors)[0])?.focus()
  }

  function change(event) {
    const { name, value } = event.target
    setValues((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
    setStatus({ kind: 'idle', text: '' })
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current) return
    const fieldErrors = validateContact(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length) {
      setStatus({ kind: 'error', text: 'Vérifiez les champs indiqués avant d’envoyer votre message.' })
      focusField(fieldErrors)
      return
    }
    lock.current = true
    setStatus({ kind: 'sending', text: 'Envoi en cours…' })
    try {
      await sendContact(values, endpoint)
      setValues(emptyContact())
      setStatus({ kind: 'success', text: 'Votre demande a bien été transmise. Merci, je vous répondrai par e-mail.' })
    } catch (error) {
      setErrors(error.fields ?? {})
      setStatus({ kind: 'error', text: error.message })
      focusField(error.fields ?? {})
    } finally {
      lock.current = false
    }
  }

  return <form className="contact-form" ref={formRef} onSubmit={submit} noValidate aria-label="Écrire à Kevin Kilongo Munganga" aria-busy={sending} aria-describedby={`${id}-privacy${!endpoint ? ` ${id}-unavailable` : ''}`}>
    <p className="contact-form__intro">Les champs indiqués par * sont obligatoires.</p>
    {!endpoint && <p className="contact-form__notice" id={`${id}-unavailable`}>Le formulaire n’est pas encore disponible. Vous pouvez me joindre par e-mail ou sur WhatsApp ci-dessous.</p>}
    <div className="contact-form__grid">
      {contactFields.map((field) => {
        const fieldId = `${id}-${field.name}`
        const props = {
          id: fieldId, name: field.name, required: field.required, autoComplete: field.autoComplete,
          minLength: field.minLength, maxLength: field.maxLength, value: values[field.name],
          onChange: change, disabled: sending, 'aria-invalid': Boolean(errors[field.name]),
          'aria-describedby': `${fieldId}-hint${errors[field.name] ? ` ${fieldId}-error` : ''}`,
        }
        return <div className={`contact-form__field${field.name === 'message' ? ' contact-form__field--wide' : ''}`} key={field.name}>
          <label htmlFor={fieldId}>{field.label}{field.required ? ' *' : ' (facultatif)'}</label>
          {field.name === 'message' ? <textarea {...props} rows={6} /> : <input {...props} type={field.type} />}
          <span className="contact-form__hint" id={`${fieldId}-hint`}>{field.minLength ? `${field.minLength} à ${field.maxLength} caractères` : `${field.maxLength} caractères maximum`}</span>
          {errors[field.name] && <span className="contact-form__error" id={`${fieldId}-error`}>{errors[field.name]}</span>}
        </div>
      })}
    </div>
    <div className="contact-form__honeypot" aria-hidden="true"><label htmlFor={`${id}-website`}>Laissez ce champ vide</label><input id={`${id}-website`} name="_gotcha" value={values._gotcha} onChange={change} tabIndex={-1} autoComplete="off" disabled={sending} /></div>
    <p className="contact-form__privacy" id={`${id}-privacy`}>Vos coordonnées servent uniquement à répondre à votre demande. Le formulaire utilise Formspree pour transmettre votre message.</p>
    <button className="button button--outline" type="submit" disabled={sending || !endpoint}>{sending ? 'Envoi en cours…' : 'Envoyer mon message'}</button>
    <div role={status.kind === 'error' ? 'alert' : 'status'} aria-atomic="true">{status.text && <p className={status.kind === 'error' ? 'contact-form__error' : 'contact-form__status'}>{status.text}</p>}</div>
  </form>
}
