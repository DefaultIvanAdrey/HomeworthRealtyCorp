import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
sessionStorage.removeItem('hw-r')
createRoot(document.getElementById('root')!).render(<App />)
