import React, { useEffect, useState } from 'react';
import './_group.css';
import './entrance.css';
import { LockKeyhole } from 'lucide-react';

export function Entrance() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div dir="rtl" className="min-h-screen entrance-marble-bg flex flex-col items-center justify-center relative overflow-hidden font-['Inter'] text-[#E8ECF1]">
      {/* Lighting and Textures */}
      <div className="absolute inset-0 entrance-vignette z-0"></div>
      <div className="absolute inset-0 entrance-spotlight z-0"></div>
      
      {/* Precision Corner Brackets (Platinum) */}
      <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-[#9FB4C7]/20 z-0"></div>
      <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-[#9FB4C7]/20 z-0"></div>
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-[#9FB4C7]/20 z-0"></div>
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-[#9FB4C7]/20 z-0"></div>

      {/* Frame / Hairline */}
      <div className="absolute inset-6 border border-[#9FB4C7]/5 z-0 pointer-events-none hidden md:block"></div>

      {/* Specular highlights */}
      <div className="absolute top-[35%] left-[25%] w-1 h-1 bg-[#CDBFA4]/30 rounded-full blur-[1px] animate-pulse-slow"></div>
      <div className="absolute bottom-[45%] right-[25%] w-1.5 h-1.5 bg-[#9FB4C7]/30 rounded-full blur-[2px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[60%] right-[15%] w-0.5 h-0.5 bg-[#E8ECF1]/40 rounded-full blur-[0.5px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>

      {/* Horizon Hairline */}
      <div className="absolute bottom-[30%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#9FB4C7]/10 to-transparent z-0 blur-[1px] opacity-30"></div>

      {/* Main Content */}
      <div className={`flex flex-col items-center z-10 transition-all duration-[2000ms] ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        
        {/* Elite Tags */}
        <div className="flex items-center gap-4 mb-12">
           <span className="text-[10px] tracking-[0.3em] text-[#CDBFA4]/70 uppercase font-light">Private Client</span>
           <span className="w-1 h-1 bg-[#CDBFA4]/30 rounded-full"></span>
           <span className="text-[10px] tracking-[0.3em] text-[#CDBFA4]/70 font-light">מועדון פרטי</span>
        </div>

        {/* Emblem - Brushed Platinum/Onyx Look */}
        <div className="relative mb-14 w-28 h-28 rounded-full border border-[#9FB4C7]/20 bg-[#0A0A0B] shadow-[inset_0_4px_20px_rgba(159,180,199,0.08),0_10px_40px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
           {/* Spotlight inner */}
           <div className="absolute inset-0 bg-gradient-to-b from-[#9FB4C7]/15 to-transparent"></div>
           <img src="/__mockup/images/brand-logo.png" alt="Heavy Guard Emblem" className="w-16 h-16 object-contain opacity-85 filter grayscale contrast-[1.3] brightness-125 relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
           <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#9FB4C7]/15 to-transparent gleam-sweep z-20"></div>
           {/* Champagne edge light */}
           <div className="absolute inset-0 rounded-full border border-[#CDBFA4]/10 pointer-events-none"></div>
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl md:text-5xl font-['Playfair_Display'] tracking-[0.3em] uppercase mb-8 text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#D3D9E0] to-[#717882] drop-shadow-[0_4px_15px_rgba(0,0,0,1)]">
          Heavy Guard
        </h1>
        
        {/* Tier Chip */}
        <div className="mb-12 px-5 py-2 border border-[#9FB4C7]/20 bg-[#030303]/80 backdrop-blur shadow-[0_0_20px_rgba(0,0,0,0.8)] flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-[#000] border border-[#9FB4C7]/60 rounded-full"></div>
          <span className="text-[9px] tracking-[0.4em] text-[#9FB4C7] font-['Space_Mono'] uppercase pt-0.5">Obsidian Tier</span>
        </div>

        {/* Concierge Greeting */}
        <p className="text-[#8A9099] tracking-wider text-[13px] md:text-sm mb-16 font-light opacity-80 text-center leading-relaxed">
          ערב טוב.<br/>הכניסה שמורה לחברי המועדון.
        </p>

        {/* Action Controls */}
        <div className="flex flex-col items-center gap-6 w-full max-w-[320px]">
          {/* Primary CTA */}
          <button className="group relative w-full overflow-hidden bg-[#0A0A0B] border border-[#9FB4C7]/20 text-[#E8ECF1] px-8 py-4.5 font-light tracking-[0.2em] uppercase transition-all duration-700 hover:border-[#CDBFA4]/30 hover:shadow-[0_0_30px_rgba(205,191,164,0.05)]">
            <span className="relative z-10 flex items-center justify-center gap-3">
              כניסה למועדון <LockKeyhole className="w-3.5 h-3.5 opacity-60 group-hover:text-[#CDBFA4] transition-colors duration-500" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9FB4C7]/5 to-transparent -translate-x-full group-hover:animate-sweep"></div>
          </button>
          
          {/* Secondary CTA */}
          <button className="relative text-[#5A6068] text-[10px] tracking-[0.2em] uppercase transition-all duration-500 hover:text-[#9FB4C7] pb-1 border-b border-transparent hover:border-[#9FB4C7]/30">
            סיור מודרך
          </button>
        </div>
      </div>

      {/* Precise Footer */}
      <div dir="ltr" className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[#3A3F45] text-[9px] tracking-[0.25em] font-['Space_Mono'] uppercase flex items-center gap-4 z-10 whitespace-nowrap">
        <span>Heavy Guard</span>
        <span className="w-[3px] h-[3px] bg-[#3A3F45] rounded-full"></span>
        <span>Est. MMXXVI</span>
        <span className="w-[3px] h-[3px] bg-[#3A3F45] rounded-full"></span>
        <span className="tracking-[0.1em] font-['Inter']">דמו לימודי בלבד</span>
      </div>
    </div>
  );
}
