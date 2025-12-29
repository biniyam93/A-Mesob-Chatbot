
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sources?: string[];
}

export interface DocumentInfo {
  id: string;
  name: string;
  type: string;
  content: string;
  size: number;
  uploadDate: number;
  chunkCount: number;
}

export type ViewType = 'login' | 'chat' | 'admin_dashboard' | 'admin_reports';

export interface AppState {
  user: User | null;
  currentView: ViewType;
  messages: ChatMessage[];
  documents: DocumentInfo[];
  isProcessing: boolean;
  activeDocumentId: string | null;
}
