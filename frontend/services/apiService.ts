import { CampaignFocus, Customer, InboundEmail } from "../types";
import { getCurrentLanguage } from 'src/i18n';

// API Service
// 处理所有与后端API的通信

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
    const response = await fetch('http://localhost:3001/api/outbound/generate', {
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
): Promise<{ intent: string; draft: string; confidence: number; sources?: string[] }> => {
  const currentLanguage = getCurrentLanguage();

  try {
    const response = await fetch('http://localhost:3001/api/inbound/analyze', {
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
      draft: fallbackDraft,
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
    const response = await fetch('http://localhost:3001/api/email/summarize', {
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
 * Send email
 */
export const sendEmail = async (to: string, subject: string, content: string): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3001/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, content })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Send failed');
    }
    
    const data = await response.json();
    console.log('Email send result:', data);
    return data.success || false;
  } catch (error) {
    console.error("Send Email Error:", error);
    return false;
  }
};

/**
 * Configure email settings
 */
export const configureEmail = async (config: {
  email: string;
  password: string;
  imapHost: string;
  smtpHost: string;
  senderName: string;
}): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3001/api/email/configure', {
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