
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircleQuestion, Send, Sparkles, Loader2, User } from "lucide-react";
import { cn } from '@/lib/utils';

import { useProcesos } from '@/contexts/ProcesosContext';
import { useActividades } from '@/contexts/ActividadesContext';
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

  const { procesos } = useProcesos();
  const { actividades } = useActividades();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  useEffect(() => {
    // Scroll to the bottom when messages change
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context data
      const processContext = procesos
        .filter(p => !p.deletedAt && p.activo)
        .map(p => `Proceso: ${p.proceso}\nDescripción: ${p.descripcion}\nÁrea: ${p.area}\nPuesto: ${p.puesto}\n`)
        .join('---\n');
      
      const activityContext = actividades
        .filter(a => a.activa)
        .map(a => `Actividad: ${a.nombre}\nDescripción: ${a.descripcionBreve || 'N/A'}\n`)
        .join('---\n');
        
      const fullContext = `--- INICIO CONTEXTO PROCESOS ---\n${processContext}\n--- FIN CONTEXTO PROCESOS ---\n\n--- INICIO CONTEXTO ACTIVIDADES ---\n${activityContext}\n--- FIN CONTEXTO ACTIVIDADES ---`;
      
      const response = await queryConversationalAgent({
        question: input,
        contextData: fullContext,
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
            Haga preguntas en lenguaje natural sobre los procesos y actividades registrados en SIAP.
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
                    "¿Quién es el responsable del proceso de gestión de pedidos?" <br/>
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
