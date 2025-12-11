export interface Customer {
  id: string;
  name: string;
  email: string;
  position: string;
  company: string;
  painPoint?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  generatedDraft?: string;
}

export interface InboundEmail {
  id: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  content: string;
  receivedAt: string;
  status: 'unread' | 'analyzing' | 'drafted' | 'replied';
  intent?: 'Sales' | 'Technical' | 'Support' | 'Spam';
  draftReply?: string;
  confidence?: number;
  summary?: string;
  sources?: string[];
}

export interface DocumentFile {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  type: 'PDF' | 'DOCX' | 'TXT';
}

export enum CampaignFocus {
  PRODUCT_INTRODUCTION = 'Product Introduction',
  PARTNERSHIP = 'Partnership Opportunity'
}