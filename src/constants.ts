import { LayoutDashboard, Bot, MessageSquare, BrainCircuit, Database, Network, Cpu, ShieldAlert, FileText, Settings, MessagesSquare } from 'lucide-react';

export const navigation = [
  { id: 'inicio', name: 'Inicio', icon: LayoutDashboard },
  { id: 'agentes', name: 'Agentes de IA', icon: Bot },
  { id: 'chat', name: 'Chat IA', icon: MessagesSquare },
  { id: 'telegram', name: 'Telegram', icon: MessageSquare },
  { id: 'modelos', name: 'Modelos de IA', icon: BrainCircuit },
  { id: 'firebase', name: 'Firebase', icon: Database },
  { id: 'comunicacion', name: 'Comunicación', icon: Network },
  { id: 'worker', name: 'Cloudflare Worker', icon: Cpu },
  { id: 'seguridad', name: 'Seguridad', icon: ShieldAlert },
  { id: 'logs', name: 'Registros técnicos', icon: FileText },
  { id: 'configuracion', name: 'Configuración', icon: Settings },
];
