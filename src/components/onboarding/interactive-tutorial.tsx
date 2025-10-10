'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  Target,
  Zap,
  Users,
  BarChart3
} from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: string;
  tip?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Dashboard!',
    description: 'Este é seu painel principal onde você pode ver todas as informações importantes.',
    target: '.dashboard-main',
    position: 'bottom',
    tip: 'Use este espaço para monitorar o desempenho geral'
  },
  {
    id: 'sidebar',
    title: 'Menu de Navegação',
    description: 'Use o menu lateral para navegar entre as diferentes seções da plataforma.',
    target: '.sidebar',
    position: 'right',
    action: 'Clique em qualquer item do menu para explorar'
  },
  {
    id: 'clients',
    title: 'Gerenciar Clientes',
    description: 'Aqui você pode adicionar e gerenciar todos os seus clientes.',
    target: '[href="/dashboard/clients"]',
    position: 'right',
    action: 'Clique para adicionar seu primeiro cliente'
  },
  {
    id: 'meta',
    title: 'Conectar Meta Ads',
    description: 'Conecte suas contas do Meta Ads para começar a importar dados de campanhas.',
    target: '[href="/dashboard/meta"]',
    position: 'right',
    action: 'Conecte suas contas de anúncios aqui'
  },
  {
    id: 'reports',
    title: 'Relatórios e Insights',
    description: 'Visualize relatórios detalhados e insights sobre suas campanhas.',
    target: '[href="/dashboard/reports"]',
    position: 'right',
    tip: 'Os relatórios são atualizados automaticamente'
  },
  {
    id: 'team',
    title: 'Gerenciar Equipe',
    description: 'Convide membros para sua organização e gerencie permissões.',
    target: '[href="/dashboard/team"]',
    position: 'right',
    action: 'Convide sua equipe para colaborar'
  }
];

interface InteractiveTutorialProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export default function InteractiveTutorial({ onComplete, onSkip }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isVisible && currentStep < tutorialSteps.length) {
      highlightElement(tutorialSteps[currentStep].target);
    }

    return () => {
      removeHighlight();
    };
  }, [currentStep, isVisible]);

  const highlightElement = (selector: string) => {
    removeHighlight();
    
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.style.position = 'relative';
      element.style.zIndex = '1001';
      element.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2)';
      element.style.borderRadius = '8px';
      element.style.transition = 'all 0.3s ease';
      
      setHighlightedElement(element);
      
      // Scroll to element
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  };

  const removeHighlight = () => {
    if (highlightedElement) {
      highlightedElement.style.boxShadow = '';
      highlightedElement.style.zIndex = '';
      highlightedElement.style.position = '';
      highlightedElement.style.borderRadius = '';
      setHighlightedElement(null);
    }
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    removeHighlight();
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    removeHighlight();
    setIsVisible(false);
    onSkip?.();
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const startAutoPlay = () => {
    setIsPlaying(true);
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < tutorialSteps.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          clearInterval(interval);
          return prev;
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  };

  if (!isVisible || currentStep >= tutorialSteps.length) {
    return null;
  }

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-1000 pointer-events-none" />
      
      {/* Tutorial Card */}
      <div className="fixed top-4 right-4 z-1002 w-80">
        <Card className="shadow-2xl border-2 border-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-blue-600" />
                </div>
                <Badge variant="outline" className="text-xs">
                  Tutorial Interativo
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Passo {currentStep + 1} de {tutorialSteps.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div>
              <CardTitle className="text-lg mb-2">{step.title}</CardTitle>
              <CardDescription className="text-sm">
                {step.description}
              </CardDescription>
            </div>

            {step.action && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">{step.action}</p>
                </div>
              </div>
            )}

            {step.tip && (
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">{step.tip}</p>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={isPlaying ? () => setIsPlaying(false) : startAutoPlay}
                  className="h-8 w-8 p-0"
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestart}
                  className="h-8 w-8 p-0"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                >
                  {currentStep === tutorialSteps.length - 1 ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Concluir
                    </>
                  ) : (
                    <>
                      Próximo
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step Indicators */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-1002">
        <div className="flex space-x-2 bg-white rounded-full px-4 py-2 shadow-lg">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}