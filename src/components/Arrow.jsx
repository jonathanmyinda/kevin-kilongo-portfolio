export default function Arrow({ direction = 'up-right' }) {
  return <span aria-hidden="true" className="arrow">{direction === 'left' ? '←' : direction === 'right' ? '→' : direction === 'down' ? '↓' : '↗'}</span>
}
