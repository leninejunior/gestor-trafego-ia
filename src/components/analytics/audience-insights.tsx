'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Users,
  MapPin,
  Calendar,
  Smartphone,
  Clock,
  TrendingUp,
  Target,
  Heart,
  ShoppingBag,
  Gamepad2,
  Music,
  Car,
  Home
} from "lucide-react";

export default function AudienceInsights() {
  const [selectedSegment, setSelectedSegment] = useState('demographics');

  // Dados simulados de audiência
  const audienceData = {
    demographics: {
      age: [
        { range: '18-24', percentage: 15, performance: 'high' },
        { range: '25-34', percentage: 35, performance: 'very-high' },
        { range: '35-44', percentage: 28, performance: 'high' },
        { range: '45-54', percentage: 15, performance: 'medium' },
        { range: '55+', percentage: 7, performance: 'low' }
      ],
      gender: [
        { type: 'Feminino', percentage: 58, performance: 'high' },
        { type: 'Masculino', percentage: 40, performance: 'medium' },
        { type: 'Não especificado', percentage: 2, performance: 'low' }
      ]
    },
    geography: [
      { location: 'São Paulo - SP', percentage: 25, performance: 'very-high' },
      { location: 'Rio de Janeiro - RJ', percentage: 18, performance: 'high' },
      { location: 'Belo Horizonte - MG', percentage: 12, performance: 'high' },
      { location: 'Brasília - DF', percentage: 10, performance: 'medium' },
      { location: 'Salvador - BA', percentage: 8, performance: 'medium' },
      { location: 'Outros', percentage: 27, performance: 'medium' }
    ],
    devices: [
      { type: 'Mobile', percentage: 75, performance: 'high' },
      { type: 'Desktop', percentage: 20, performance: 'medium' },
      { type: 'Tablet', percentage: 5, performance: 'low' }
    ],
    timing: [
      { period: 'Manhã (6h-12h)', percentage: 20, performance: 'medium' },
      { period: 'Tarde (12h-18h)', percentage: 35, performance: 'high' },
      { period: 'Noite (18h-24h)', percentage: 40, performance: 'very-high' },
      { period: 'Madrugada (0h-6h)', percentage: 5, performance: 'low' }
    ],
    interests: [
      { category: 'Compras Online', icon: <ShoppingBag className="w-4 h-4" />, percentage: 45, performance: 'very-high' },
      { category: 'Tecnologia', icon: <Smartphone className="w-4 h-4" />, percentage: 38, performance: 'high' },
      { category: 'Música', icon: <Music className="w-4 h-4" />, percentage: 32, performance: 'high' },
      { category: 'Automóveis', icon: <Car className="w-4 h-4" />, percentage: 28, performance: 'medium' },
      { category: 'Casa e Decoração', icon: <Home className="w-4 h-4" />, percentage: 25, performance: 'medium' },
      { category: 'Games', icon: <Gamepad2 className="w-4 h-4" />, percentage: 22, performance: 'medium' }
    ]
  };

  const segments = [
    { value: 'demographics', label: 'Demografia', icon: <Users className="w-4 h-4" /> },
    { value: 'geography', label: 'Geografia', icon: <MapPin className="w-4 h-4" /> },
    { value: 'devices', label: 'Dispositivos', icon: <Smartphone className="w-4 h-4" /> },
    { value: 'timing', label: 'Horários', icon: <Clock className="w-4 h-4" /> },
    { value: 'interests', label: 'Interesses', icon: <Heart className="w-4 h-4" /> }
  ];

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'very-high':
        return 'text-green-600 bg-green-100';
      case 'high':
        return 'text-blue-600 bg-blue-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getPerformanceLabel = (performance: string) => {
    switch (performance) {
      case 'very-high':
        return '🔥 Excelente';
      case 'high':
        return '⭐ Alto';
      case 'medium':
        return '📊 Médio';
      case 'low':
        return '⚠️ Baixo';
      default:
        return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Insights de Audiência
              </CardTitle>
              <CardDescription>
                Análise detalhada do comportamento e características da sua audiência
              </CardDescription>
            </div>
            <div className="flex items-center space-x-1">
              {segments.map((segment) => (
                <Button
                  key={segment.value}
                  variant={selectedSegment === segment.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSegment(segment.value)}
                  className="flex items-center space-x-1"
                >
                  {segment.icon}
                  <span>{segment.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Audiência Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">2.4M</div>
            <p className="text-xs text-gray-500">Pessoas alcançadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Engajamento Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">4.2%</div>
            <p className="text-xs text-gray-500">Taxa de engajamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Melhor Segmento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-purple-600">25-34 anos</div>
            <p className="text-xs text-gray-500">Maior conversão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Crescimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-2xl font-bold text-green-600">+18%</span>
            </div>
            <p className="text-xs text-gray-500">Últimos 30 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo por Segmento */}
      {selectedSegment === 'demographics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Idade</CardTitle>
              <CardDescription>
                Performance por faixa etária
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {audienceData.demographics.age.map((age, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{age.range} anos</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{age.percentage}%</span>
                        <Badge className={getPerformanceColor(age.performance)}>
                          {getPerformanceLabel(age.performance)}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={age.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Gênero</CardTitle>
              <CardDescription>
                Performance por gênero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {audienceData.demographics.gender.map((gender, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{gender.type}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">{gender.percentage}%</span>
                        <Badge className={getPerformanceColor(gender.performance)}>
                          {getPerformanceLabel(gender.performance)}
                        </Badge>
                      </div>
                    </div>
                    <Progress value={gender.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedSegment === 'geography' && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição Geográfica</CardTitle>
            <CardDescription>
              Performance por localização
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audienceData.geography.map((location, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{location.location}</span>
                    </div>
                    <Badge className={getPerformanceColor(location.performance)}>
                      {getPerformanceLabel(location.performance)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Participação</span>
                    <span className="font-medium">{location.percentage}%</span>
                  </div>
                  <Progress value={location.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSegment === 'devices' && (
        <Card>
          <CardHeader>
            <CardTitle>Dispositivos Utilizados</CardTitle>
            <CardDescription>
              Performance por tipo de dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {audienceData.devices.map((device, index) => (
                <div key={index} className="text-center p-6 border rounded-lg">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">{device.type}</h3>
                  <div className="text-2xl font-bold text-blue-600 mb-2">
                    {device.percentage}%
                  </div>
                  <Badge className={getPerformanceColor(device.performance)}>
                    {getPerformanceLabel(device.performance)}
                  </Badge>
                  <div className="mt-4">
                    <Progress value={device.percentage} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSegment === 'timing' && (
        <Card>
          <CardHeader>
            <CardTitle>Horários de Maior Atividade</CardTitle>
            <CardDescription>
              Performance por período do dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {audienceData.timing.map((time, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{time.period}</span>
                    </div>
                    <Badge className={getPerformanceColor(time.performance)}>
                      {getPerformanceLabel(time.performance)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Atividade</span>
                    <span className="font-medium">{time.percentage}%</span>
                  </div>
                  <Progress value={time.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSegment === 'interests' && (
        <Card>
          <CardHeader>
            <CardTitle>Interesses da Audiência</CardTitle>
            <CardDescription>
              Categorias de interesse com melhor performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {audienceData.interests.map((interest, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      {interest.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{interest.category}</h4>
                      <p className="text-sm text-gray-500">{interest.percentage}% da audiência</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getPerformanceColor(interest.performance)}>
                      {getPerformanceLabel(interest.performance)}
                    </Badge>
                  </div>
                  <Progress value={interest.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights e Recomendações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Insights e Recomendações
          </CardTitle>
          <CardDescription>
            Descobertas importantes sobre sua audiência
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-green-800">✅ Pontos Fortes</h4>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>Faixa 25-34 anos:</strong> Representa 35% da audiência com excelente performance
                  </p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>Horário noturno:</strong> 40% da atividade concentrada entre 18h-24h
                  </p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>Mobile first:</strong> 75% da audiência usa dispositivos móveis
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium text-blue-800">🎯 Oportunidades</h4>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Expandir para 35-44 anos:</strong> Segmento com boa performance e potencial
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Otimizar para desktop:</strong> Apenas 20% mas com potencial de conversão
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Explorar interesses em tecnologia:</strong> 38% da audiência com alta performance
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}