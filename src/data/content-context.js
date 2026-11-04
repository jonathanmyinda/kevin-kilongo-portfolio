import {createContext,useContext} from 'react'
import * as staticContent from './catalog'
export const ContentContext=createContext(null)
export const useContent=()=>useContext(ContentContext)||staticContent
