import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Logo } from '../../components/ui/Logo'
export default function NotFound() {
  return (
    <div className="container-app flex min-h-[100dvh] flex-col py-6">
      <Logo />
      <div className="m-auto max-w-md text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mist text-slate-500"><Compass size={26} /></span>
        <h1 className="mt-5 text-[30px] font-semibold">We couldn't find that page</h1>
        <p className="mt-2 text-slate-600">The link may be old or mistyped. If you need urgent help, call 112.</p>
        <div className="mt-6 flex justify-center gap-3"><Link to="/" className="btn btn-primary">Go home</Link><Link to="/emergency" className="btn btn-danger">Emergency</Link></div>
      </div>
    </div>
  )
}
