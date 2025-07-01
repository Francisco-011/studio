
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircleQuestion, Send, Sparkles, Loader2, User } from "lucide-react";
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

import { useProcesos } from '@/contexts/ProcesosContext';
import { useProcedimientos } from '@/contexts/ProcedimientosContext';
import { useActividades } from '@/contexts/ActividadesContext';
import { usePoliticas } from '@/contexts/PoliticasContext';
import { useExceptions } from '@/contexts/ExceptionsContext';
import { queryConversationalAgent } from '@/ai/flows/conversational-query-flow';
import { toast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ConsultaIaPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const { procesos } = useProcesos();
  const { procedimientos } = useProcedimientos();
  const { actividades } = useActividades();
  const { politicas } = usePoliticas();
  const { exceptions } = useExceptions();


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!user) {
      toast({ title: "Error de autenticación", description: "No se pudo identificar al usuario.", variant: "destructive"});
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const processContext = procesos
        .filter(p => !p.deletedAt)
        .map(p => `
---
Entidad: Proceso
ID: ${p.id}
Nombre: ${p.proceso}
Código: ${p.codigo}
Descripción: ${p.descripcion}
Clasificación: ${p.clasificacion}
Área: ${p.area}
Puesto: ${p.puesto}
Políticas Vinculadas (IDs): [${p.politicasAsociadas?.map(link => link.policyId).join(', ') || ''}]
---
        `).join('\n\n');
        
      const procedimientoContext = procedimientos
        .map(p => {
          const parentProcess = procesos.find(proc => proc.id === p.procesoId);
          return `
---
Entidad: Procedimiento
ID: ${p.id}
Nombre: ${p.nombre}
Código: ${p.codigo}
Descripción: ${p.descripcion || 'N/A'}
Proceso Padre: ${parentProcess?.proceso || 'N/A'} (ID: ${p.procesoId})
---
          `;
        }).join('\n\n');

      const activityContext = actividades
        .map(a => {
           const parentProcedimiento = procedimientos.find(p => p.id === a.procedimientoId);
           return `
---
Entidad: Actividad
ID: ${a.id}
Nombre: ${a.nombre}
Código: ${a.codigo}
Descripción: ${a.descripcionBreve || 'N/A'}
Procedimiento Padre: ${parentProcedimiento?.nombre || 'N/A'} (ID: ${a.procedimientoId})
---
           `
        }).join('\n\n');
        
      const politicaContext = politicas
          .map(p => `
---
Entidad: Política
ID: ${p.id}
Nombre: ${p.titulo}
Código: ${p.codigo}
Descripción: ${p.descripcion}
Clasificación: ${p.clasificacion}
---
          `).join('\n\n');
          
      const fullContext = `Contexto de Procesos:\n${processContext}\n\nContexto de Procedimientos:\n${procedimientoContext}\n\nContexto de Actividades:\n${activityContext}\n\nContexto de Políticas:\n${politicaContext}`;

      const response = await queryConversationalAgent({
        question: input,
        contextData: fullContext,
        userRole: user.rol,
        userAccessLevel: user.nivelAcceso,
      });

      const assistantMessage: Message = { role: 'assistant', content: response.answer };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Error al consultar a la IA:", error);
      toast({
        title: "Error de comunicación con la IA",
        description: "No se pudo obtener una respuesta. Por favor, inténtelo de nuevo más tarde.",
        variant: "destructive",
      });
       const errorMessage: Message = { role: 'assistant', content: "Lo siento, tuve un problema para procesar tu pregunta. Por favor, intenta de nuevo." };
       setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg h-[calc(100vh-120px)] flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircleQuestion className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Consulta con Asistente IA</CardTitle>
          </div>
          <CardDescription>
            Haga preguntas en lenguaje natural sobre los procesos, procedimientos, actividades y políticas registrados en PROSCENDIA.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col p-4">
          <ScrollArea className="flex-grow mb-4 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                  <Sparkles className="h-16 w-16 mb-4" />
                  <p className="font-semibold">¡Bienvenido al Asistente de Consulta!</p>
                  <p className="text-sm">
                    Puedes preguntar, por ejemplo: <br/>
                    "¿Cuál es el propósito del proceso de cierre contable?" <br/>
                    "¿Qué políticas aplican al procedimiento de facturación?" <br/>
                    "Describe la actividad de 'Aprobar Factura'."
                  </p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-4",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Sparkles className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-md rounded-lg p-3 text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.content}
                  </div>
                   {message.role === 'user' && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                  <div className="flex items-start gap-4 justify-start">
                     <Avatar className="h-8 w-8">
                       <AvatarFallback className="bg-primary text-primary-foreground">
                        <Sparkles className="h-5 w-5" />
                       </AvatarFallback>
                     </Avatar>
                     <div className="bg-muted rounded-lg p-3 text-sm flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2"/>
                        Pensando...
                     </div>
                  </div>
              )}
            </div>
          </ScrollArea>
          <div className="mt-auto">
            <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
              <Input
                id="message"
                placeholder="Escriba su pregunta aquí..."
                className="flex-1"
                autoComplete="off"
                value={input}
                onChange={handleInputChange}
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Enviar</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
