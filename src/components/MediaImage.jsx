export default function MediaImage({ image, eager = false, sizes = '(max-width: 600px) calc(100vw - 40px), (max-width: 850px) 46vw, 42vw', style, ...props }) {
  return <img src={image.src} srcSet={image.srcSet} sizes={image.srcSet ? sizes : undefined} alt={image.alt} width={image.width} height={image.height} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" style={style} {...props} />
}
