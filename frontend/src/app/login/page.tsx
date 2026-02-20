import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left Panel: Branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center px-16 bg-[#22184c] text-white relative overflow-hidden">
        {/* Abstract atom graphic */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
            <circle cx="400" cy="400" r="300" fill="none" stroke="white" strokeWidth="2" strokeDasharray="10 20" />
            <ellipse cx="400" cy="400" rx="350" ry="100" fill="none" stroke="white" strokeWidth="2" transform="rotate(45 400 400)" />
            <ellipse cx="400" cy="400" rx="350" ry="100" fill="none" stroke="white" strokeWidth="2" transform="rotate(-45 400 400)" />
          </svg>
        </div>

        <div className="relative z-10">
          <div className="mb-12">
            <h1 className="text-5xl font-bold mb-1 tracking-tight">
              sim<span className="font-light">estearina</span>
            </h1>
            <p className="text-xs font-semibold tracking-[0.3em] text-[#1893c8]">INDÚSTRIA & COMÉRCIO</p>
          </div>

          <h2 className="text-4xl font-extrabold leading-tight mb-6">
            Plataforma de<br />
            Atendimento
          </h2>
          <p className="text-lg text-indigo-200 max-w-md leading-relaxed">
            Sua comunicação corporativa em um novo ritmo. Integrando o padrão de qualidade Sim Estearina com a inteligência em tempo real do sistema Veloce.
          </p>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gray-50 p-8 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo only shows on small screens */}
          <div className="lg:hidden mb-8 text-center">
            <h1 className="text-3xl font-bold text-[#22184c] mb-1 tracking-tight">
              sim<span className="font-light">estearina</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#1893c8]">INDÚSTRIA & COMÉRCIO</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
