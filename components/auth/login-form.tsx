"use client";

import { useState } from "react";
import { Mail, Lock, Eye, Sparkles } from "lucide-react";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-[480px] p-8 sm:p-10 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl">
      
      {/* Top Welcome Pill */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 shadow-inner">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Welcome back! Please sign in to continue</span>
        </div>
      </div>

      {/* Headers */}
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Welcome Back</h2>
        <p className="text-gray-400">Sign in to your Finance AI account</p>
      </div>

      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        
        {/* Email Input */}
        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="email"
            placeholder="Email address"
            className="w-full pl-12 pr-4 h-14 bg-[#1A1D2D]/50 border border-white/10 text-white placeholder:text-gray-500 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Password Input */}
        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="w-full pl-12 pr-12 h-14 bg-[#1A1D2D]/50 border border-white/10 text-white placeholder:text-gray-500 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
          <button 
            type="button" 
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
          >
            <Eye className="w-5 h-5 text-gray-500 hover:text-gray-300 transition-colors" />
          </button>
        </div>

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between text-sm py-2">
          <label className="flex items-center gap-3 text-gray-300 cursor-pointer group">
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                className="peer appearance-none w-5 h-5 border border-gray-600 rounded bg-white/5 checked:bg-indigo-500 checked:border-indigo-500 transition-all cursor-pointer" 
              />
              <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none">
                <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="group-hover:text-white transition-colors">Remember me</span>
          </label>
          <a href="#" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
            Forgot password?
          </a>
        </div>

        {/* Primary Submit Button */}
        <button 
          type="submit"
          className="w-full h-14 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white rounded-xl text-lg font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 group"
        >
          Sign In
          <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="h-px bg-white/10 flex-1"></div>
        <span className="text-sm text-gray-500">or continue with</span>
        <div className="h-px bg-white/10 flex-1"></div>
      </div>

      {/* Google SSO Button */}
      <button 
        type="button"
        className="w-full h-14 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl flex items-center justify-center gap-3 transition-all font-medium"
      >
        {/* Sized SVG fallback for Google Logo */}
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      {/* Sign Up Link */}
      <p className="text-center text-sm text-gray-400 mt-8">
        Don't have an account?{' '}
        <a href="#" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
          Sign up
        </a>
      </p>
    </div>
  );
}