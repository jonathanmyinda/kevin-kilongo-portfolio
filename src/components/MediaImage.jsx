import {useState} from 'react'
import {useContent} from '../data/content-context'
export default function MediaImage({ image, eager = false, sizes = '(max-width: 600px) calc(100vw - 40px), (max-width: 850px) 46vw, 42vw', style, ...props }) {
  const [retry,setRetry]=useState(null),content=useContent()
  const retrying=retry===image.src
  const src=retrying&&image.id?image.src+'&retry=1':image.src
  return <img src={src} onError={()=>{if(image.id&&!retrying){setRetry(image.src);void content.refresh?.()}}} srcSet={retrying?undefined:image.srcSet} sizes={image.srcSet ? sizes : undefined} alt={image.alt} width={image.width} height={image.height} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" style={style} {...props} />
}
