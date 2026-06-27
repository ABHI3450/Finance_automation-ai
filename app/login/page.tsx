import LoginForm from "@/components/auth/login-form";
import { Brain, Zap, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0B0D17] text-white flex relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-purple-900/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-blue-900/20 blur-[120px] rounded-full" />
      </div>

      {/* Left Panel - Branding & Features (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 p-12 flex-col justify-between relative z-10">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20" />
            <span className="text-xl font-bold tracking-wide">Finance AI</span>
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-[1.15]">
            Your AI Copilot <br />
            for Smarter <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Finance
            </span>
          </h1>
          <p className="text-gray-400 max-w-md mb-12 text-lg leading-relaxed">
            Automate your financial operations, get real-time insights, and make data-driven decisions with the power of AI.
          </p>

          {/* Feature List */}
          <div className="space-y-8">
            <FeatureItem
              icon={<Brain className="w-6 h-6" />}
              title="AI-Powered Insights"
              desc="Smart analytics that help you grow faster"
            />
            <FeatureItem
              icon={<Zap className="w-6 h-6" />}
              title="Real-time Automation"
              desc="Automate invoices, reports, and reconciliations"
            />
            <FeatureItem
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Bank-Level Security"
              desc="Your data is encrypted and always protected"
            />
          </div>
        </div>

        {/* Floating Glass Graphic Placeholder */}
        <div className="mt-12 w-[300px] bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative">
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-blue-500/20 blur-2xl rounded-full" />
          <p className="text-sm text-gray-400 font-medium mb-1">Cash Flow</p>
          <p className="text-3xl font-bold text-blue-400">+24.8%</p>
          {/* Simple CSS graph representation */}
          <div className="mt-4 flex items-end gap-2 h-16">
            {[40, 70, 45, 90, 65, 100].map((height, i) => (
              <div key={i} className="w-full bg-blue-500/20 rounded-t-sm" style={{ height: `${height}%` }}>
                <div className="w-full bg-blue-400/50 h-1 rounded-t-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <LoginForm />
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-5 items-start">
      <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-indigo-400 shadow-inner">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1 text-lg">{title}</h3>
        <p className="text-gray-400">{desc}</p>
      </div>
    </div>
  );
}
