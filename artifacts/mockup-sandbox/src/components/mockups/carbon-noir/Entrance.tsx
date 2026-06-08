import React, { useEffect, useState } from 'react';
import './_group.css';
import { ChevronLeft } from 'lucide-react';

export function Entrance() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-carbon flex flex-col items-center justify-center relative overflow-hidden font-['Inter'] text-[#E8ECF1]">
      {/* Precision Corner Brackets */}
      <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-[#E8ECF1]/20"></div>
      <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-[#E8ECF1]/20"></div>
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-[#E8ECF1]/20"></div>
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-[#E8ECF1]/20"></div>

      {/* Faint Ambient Lines */}
      <div className="absolute top-[20%] left-[10%] w-[60rem] h-[1px] bg-gradient-to-r from-transparent via-[#E8ECF1]/5 to-transparent -rotate-45 blur-[1px] opacity-40"></div>
      <div className="absolute bottom-[20%] right-[10%] w-[50rem] h-[1px] bg-gradient-to-r from-transparent via-[#E8ECF1]/5 to-transparent -rotate-45 blur-[1px] opacity-30"></div>

      {/* Main Content */}
      <div className={`flex flex-col items-center z-10 transition-all duration-[1500ms] ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        
        {/* Emblem - Brushed Platinum Look */}
        <div className="relative mb-10 w-32 h-32 platinum-border platinum-glow bg-[#14161A]/80 backdrop-blur-sm flex items-center justify-center overflow-hidden">
           {/* Simulate soft platinum lighting with a subtle radial gradient behind the logo */}
           <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#9FB4C7]/5 to-transparent"></div>
           <img src="/__mockup/images/brand-logo.png" alt="Heavy Guard Emblem" className="w-20 h-20 object-contain opacity-90 filter grayscale contrast-125 brightness-150" />
           <div className="gleam-highlight"></div>
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl md:text-5xl font-light tracking-[0.35em] uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#E8ECF1] to-[#8A9099] drop-shadow-sm">
          Heavy Guard
        </h1>
        
        {/* Tagline */}
        <p className="text-[#8A9099] tracking-widest text-sm uppercase mb-16 opacity-80">
          מועדון המסחר — סביבת דמו
        </p>

        {/* Action Controls */}
        <div className="flex flex-col items-center gap-5 w-full max-w-[280px]">
          {/* Primary CTA */}
          <button className="group relative w-full overflow-hidden bg-[#E8ECF1] text-[#08090A] px-8 py-3.5 font-medium tracking-widest uppercase transition-all duration-500 hover:bg-white hover:shadow-[0_0_20px_rgba(232,236,241,0.2)]">
            <span className="relative z-10 flex items-center justify-center gap-3">
              כניסה למועדון <ChevronLeft className="w-4 h-4 transition-transform duration-500 group-hover:-translate-x-1.5" />
            </span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent group-hover:animate-sweep"></div>
          </button>
          
          {/* Secondary CTA */}
          <button className="relative w-full border border-[#E8ECF1]/10 text-[#8A9099] px-8 py-3.5 text-xs tracking-widest uppercase transition-all duration-300 hover:text-[#E8ECF1] hover:border-[#E8ECF1]/30 hover:bg-[#E8ECF1]/5">
            סיור מודרך
          </button>
        </div>
      </div>

      {/* Precise Footer */}
      <div className="absolute bottom-10 text-[#5A6068] text-[10px] tracking-[0.2em] font-['Space_Mono'] uppercase flex items-center gap-3">
        <span>Heavy Guard</span>
        <span className="w-1 h-1 bg-[#5A6068]/50 rotate-45"></span>
        <span>Est. MMXXVI</span>
        <span className="w-1 h-1 bg-[#5A6068]/50 rotate-45"></span>
        <span>דמו לימודי בלבד</span>
      </div>
    </div>
  );
}
