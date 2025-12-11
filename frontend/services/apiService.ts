import { CampaignFocus, Customer, InboundEmail } from "../types";
import { getCurrentLanguage } from 'src/i18n';


// 定义 API 基础路径，优先使用环境变量，否则回退到localhost
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// API Service
// 处理所有与后端API的通信
/**
 * Generates batch outbound emails for multiple customers
 */
export const generateBatchOutboundDrafts = async (
  customers: Customer[],
  focus: CampaignFocus,
  productContext: string
): Promise<{ success: boolean; drafts: Array<{ customerId: string; draft: string; success: boolean }>; processed: number; total: number }> => {
  const currentLanguage = getCurrentLanguage();

  try {
    const response = await fetch(`${API_BASE}/api/outbound/batch-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-language': currentLanguage
      },
      body: JSON.stringify({ customers, focus, productContext, language: currentLanguage })
    });

    if (!response.ok) throw new Error('Backend request failed');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Batch Outbound Generation Error:", error);
    const errorMessage = currentLanguage === 'en'
      ? "Failed to generate batch drafts due to API error."
      : "由于 API 错误，批量生成草稿失败。";
    
    return {
      success: false,
      drafts: customers.map(customer => ({
        customerId: customer.id,
        draft: errorMessage,
        success: false
      })),
      processed: 0,
      total: customers.length
    };
  }
};

/**
 * Generates a personalized outbound email based on customer profile and campaign focus.
 */
export const generateOutboundDraft = async (
  customer: Customer,
  focus: CampaignFocus,
  productContext: string
): Promise<string> => {
  const currentLanguage = getCurrentLanguage();

  try {
    const response = await fetch(`${API_BASE}/api/outbound/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-language': currentLanguage
      },
      body: JSON.stringify({ customer, focus, productContext, language: currentLanguage })
    });

    if (!response.ok) throw new Error('Backend request failed');
    const data = await response.json();
    const fallbackMessage = currentLanguage === 'en' 
      ? "Error generating draft."
      : "生成草稿时出错。";
    return data.draft || fallbackMessage;
  } catch (error) {
    console.error("Outbound Generation Error:", error);
    const errorMessage = currentLanguage === 'en'
      ? "Failed to generate draft due to API error."
      : "由于 API 错误，生成草稿失败。";
    return errorMessage;
  }
};

/**
 * Analyzes an inbound email to determine intent and draft a response using RAG.
 */
export const analyzeAndDraftInbound = async (
  email: InboundEmail
): Promise<{ intent: string; draftReply: string; confidence: number; sources?: string[] }> => {
  const currentLanguage = getCurrentLanguage();

  try {
    const response = await fetch(`${API_BASE}/api/inbound/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-language': currentLanguage
      },
      body: JSON.stringify({ email, language: currentLanguage })
    });

    if (!response.ok) throw new Error('Backend request failed');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Inbound Analysis Error:", error);
    const fallbackDraft = currentLanguage === 'en'
      ? "Thank you for your email. We are reviewing your request and will respond shortly."
      : "感谢您的来信。我们正在审核您的请求，会尽快回复您。";
    
    return {
      intent: "Support",
      draftReply: fallbackDraft,
      confidence: 0
    };
  }
};

/**
 * Generate email summary
 */
export const generateEmailSummary = async (email: InboundEmail): Promise<string> => {
  const currentLanguage = getCurrentLanguage();

  try {
    const response = await fetch(`${API_BASE}/api/email/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-language': currentLanguage
      },
      body: JSON.stringify({ email, language: currentLanguage })
    });

    if (!response.ok) throw new Error('Backend request failed');
    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error("Summary Error:", error);
    const fallback = currentLanguage === 'en' ? 'No summary' : '无摘要';
    return email.subject || fallback;
  }
};

/**
 * Generate email subject summary
 */
export const generateSubjectSummary = async (email: InboundEmail): Promise<string> => {
  const currentLanguage = getCurrentLanguage();

  try {
    const response = await fetch(`${API_BASE}/api/email/subject-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-language': currentLanguage
      },
      body: JSON.stringify({ email, language: currentLanguage })
    });

    if (!response.ok) throw new Error('Backend request failed');
    const data = await response.json();
    return data.subjectSummary;
  } catch (error) {
    console.error("Subject Summary Error:", error);
    const fallback = currentLanguage === 'en' ? 'No subject summary' : '无主题总结';
    return email.subject || fallback;
  }
};

/**
 * Send email
 */
export const sendEmail = async (to: string, subject: string, content: string): Promise<{success: boolean, error?: string}> => {
  try {
    const response = await fetch(`${API_BASE}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, content })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Send failed');
    }
    
    console.log('Email send result:', data);
    return { success: data.success || false };
  } catch (error) {
    console.error("Send Email Error:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Configure email settings
 */
export const configureEmail = async (config: {
  email: string;
  password: string;
  imapHost: string;
  imapPort?: number;
  smtpHost: string;
  smtpPort?: number;
  senderName: string;
}): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/email/configure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) throw new Error('Configure failed');
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Configure Email Error:", error);
    return false;
  }
};

/**
 * Get email configuration
 */
export const getEmailConfig = async (): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE}/api/email/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Get config failed');
    const data = await response.json();
    return data.success ? data.config : null;
  } catch (error) {
    console.error("Get Email Config Error:", error);
    return null;
  }
};

/**
 * Get email statistics
 */
export const getEmailStats = async (): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE}/api/email/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Get stats failed');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Get Email Stats Error:", error);
    return {
      totalOutreach: 0,
      totalReplies: 0,
      pendingDrafts: 0,
      activeLeads: 0,
      responseRate: 0,
      responseRateText: '0%',
      weeklyData: []
    };
  }
};

/**
 * Get inbox emails
 */
export const getInboxEmails = async (focusMode: boolean = false): Promise<any[]> => {
  try {
    const url = `${API_BASE}/api/email/inbox${focusMode ? '?focusMode=true' : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Get inbox failed');
    const data = await response.json();
    return data.emails || [];
  } catch (error) {
    console.error("Get Inbox Emails Error:", error);
    return [];
  }
};