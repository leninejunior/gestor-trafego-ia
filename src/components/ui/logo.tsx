import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = '', size = 120 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Hexágono central */}
      <path
        d="M60 35 L75 45 L75 65 L60 75 L45 65 L45 45 Z"
        fill="#9CA3AF"
        opacity="0.6"
      />
      
      {/* Triângulos ao redor */}
      {/* Topo */}
      <path d="M60 20 L75 35 L60 45 L45 35 Z" fill="#FDE68A" opacity="0.4" />
      
      {/* Superior direito */}
      <path d="M75 35 L90 45 L75 55 L75 45 Z" fill="#C4B5FD" opacity="0.4" />
      
      {/* Inferior direito */}
      <path d="M75 55 L90 65 L75 75 L75 65 Z" fill="#A5F3FC" opacity="0.4" />
      
      {/* Baixo */}
      <path d="M60 75 L75 85 L60 95 L45 85 Z" fill="#FDE68A" opacity="0.4" />
      
      {/* Inferior esquerdo */}
      <path d="M45 65 L30 75 L45 85 L45 75 Z" fill="#C4B5FD" opacity="0.4" />
      
      {/* Superior esquerdo */}
      <path d="M45 45 L30 55 L45 65 L45 55 Z" fill="#A5F3FC" opacity="0.4" />
      
      {/* Círculos coloridos */}
      {/* Laranja (topo) */}
      <circle cx="60" cy="15" r="8" fill="#FF6B00" />
      
      {/* Roxo (superior esquerdo) */}
      <circle cx="30" cy="35" r="8" fill="#7C3AED" />
      
      {/* Azul escuro (superior direito) */}
      <circle cx="90" cy="35" r="8" fill="#1E1B4B" />
      
      {/* Azul marinho (inferior esquerdo) */}
      <circle cx="30" cy="75" r="8" fill="#1E3A8A" />
      
      {/* Azul royal (inferior direito) */}
      <circle cx="90" cy="75" r="8" fill="#0000FF" />
      
      {/* Ciano (baixo) */}
      <circle cx="60" cy="105" r="8" fill="#00D9FF" />
    </svg>
  );
}
