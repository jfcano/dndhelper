import { RouterProvider } from 'react-router-dom'
import { router } from './router'

/** Raíz de la app: enrutado centralizado en `./router`. */
export function App() {
  return <RouterProvider router={router} />
}
