import { useEffect } from 'react'

export default function PageMeta({ title, description }) {
  useEffect(() => {
    document.title = `${title} — Kevin Kilongo, architecte`
    document.querySelector('meta[name="description"]').setAttribute('content', description)
  }, [title, description])
  return null
}
