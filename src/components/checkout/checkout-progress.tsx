'use client';

import { CheckCircle, Circle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  current?: boolean;
}

interface CheckoutProgressProps {
  steps: CheckoutStep[];
  currentStep: number;
  className?: string;
}

export function CheckoutProgress({ steps, currentStep, className }: CheckoutProgressProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = step.completed || step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200",
                    {
                      "bg-green-500 border-green-500 text-white": isCompleted,
                      "bg-blue-500 border-blue-500 text-white": isCurrent && !isCompleted,
                      "bg-muted border-border text-muted-foreground": !isCurrent && !isCompleted,
                    }
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                
                {/* Step Info */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors duration-200",
                      {
                        "text-green-600": isCompleted,
                        "text-blue-600": isCurrent && !isCompleted,
                        "text-gray-500": !isCurrent && !isCompleted,
                      }
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className="flex-1 mx-4">
                  <div
                    className={cn(
                      "h-0.5 transition-colors duration-200",
                      {
                        "bg-green-500": isCompleted,
                        "bg-blue-500": isCurrent && step.id < currentStep,
                        "bg-gray-300": step.id >= currentStep,
                      }
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Versão compacta para mobile
export function CheckoutProgressMobile({ steps, currentStep, className }: CheckoutProgressProps) {
  const currentStepData = steps.find(step => step.id === currentStep);
  const totalSteps = steps.length;

  return (
    <div className={cn("w-full", className)}>
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Passo {currentStep} de {totalSteps}</span>
          <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Current Step Info */}
      {currentStepData && (
        <div className="text-center">
          <h3 className="font-medium text-gray-900">{currentStepData.title}</h3>
          <p className="text-sm text-gray-500">{currentStepData.description}</p>
        </div>
      )}
    </div>
  );
}