export interface GuardrailResult {
  isSafe: boolean;
  category?: string;
  flagReason?: string;
  safeResponse?: string;
}

export class GuardrailsService {
  // Evaluates a user query against security, policy integrity, and operational guardrails.
  public evaluate(query: string): GuardrailResult {
    if (!query || typeof query !== "string") {
      return { isSafe: true };
    }

    const clean = query.trim();
    const lower = clean.toLowerCase();

    // 0. Payload Size & Repetition Abuse (Denial of Service)
    if (clean.length > 3000) {
      return {
        isSafe: false,
        category: "Input Limit Exceeded",
        flagReason: "payload_too_large",
        safeResponse:
          "Your inquiry exceeds the maximum allowed length of 3,000 characters. Please summarize your policy question so I can assist you effectively."
      };
    }

    // Repetitive character spam (e.g., "aaaaaaaaaaa...")
    if (/(.)\1{40,}/.test(clean)) {
      return {
        isSafe: false,
        category: "Malformed Input",
        flagReason: "repetitive_spam",
        safeResponse:
          "Your inquiry contains repetitive character patterns. Please enter a valid, clear policy question."
      };
    }

    // 1. Jailbreak / Persona Override / Instruction Disregard
    const jailbreakPatterns = [
      /\bignore\s+(all|any|previous|prior|above|former|these)\s+(instructions|prompts|rules|commands|constraints|directives)\b/i,
      /\bdisregard\s+(all|any|previous|prior|above|former)\s+(instructions|prompts|rules|guidelines|policies)\b/i,
      /\byou\s+are\s+now\s+(in|a|an)?\s*(dan|developer\s+mode|unrestricted|evil|unfiltered|jailbroken|god\s+mode|chaos\s+mode)\b/i,
      /\bact\s+as\s+(dan|an?\s+unrestricted|an?\s+evil|an?\s+unfiltered|a\s+hacker|chaos)\b/i,
      /\bdo\s+anything\s+now\b/i,
      /\bpretend\s+(there\s+are\s+no|you\s+have\s+no)\s+(rules|policies|restrictions|guidelines)\b/i,
      /\bbypass\s+(all\s+)?(security|policy|restrictions|safety\s+filters|guidelines)\b/i,
      /\bforget\s+(all\s+)?(your\s+rules|your\s+instructions|your\s+prompt|everything\s+above)\b/i,
      /\bnew\s+system\s+directive:\b/i
    ];

    for (const pattern of jailbreakPatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Security Guardrail",
          flagReason: "jailbreak_attempt",
          safeResponse:
            "I cannot fulfill this request. I operate exclusively as an internal company policy assistant and cannot disregard my security instructions, alter my core role, or bypass company policy guidelines."
        };
      }
    }

    // 2. System Prompt & Secret Exfiltration
    const exfiltrationPatterns = [
      /\b(what\s+is|print|repeat|show|reveal|display|output|leak|give\s+me)\s+(your|the)\s+(system\s+prompt|initial\s+instructions|prompt\s+template|internal\s+instructions|hidden\s+rules|system\s+message|developer\s+message)\b/i,
      /\b(print|reveal|show|what\s+is|give\s+me|leak)\s+(the|your)?\s*(api[_\s]?key|secret[_\s]?key|env|environment\s+variable|database\s+password|mongo[_\s]?uri|gemini[_\s]?key|grok[_\s]?key)\b/i,
      /\brepeat\s+everything\s+(written\s+)?above\b/i,
      /\bwhat\s+were\s+the\s+instructions\s+given\s+to\s+you\b/i,
      /\bverbatim\s+system\s+prompt\b/i
    ];

    for (const pattern of exfiltrationPatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Security Guardrail",
          flagReason: "secret_exfiltration",
          safeResponse:
            "I cannot disclose system prompts, internal instructions, API keys, or infrastructure configurations. I am here to help you understand official employee policies and workplace guidelines."
        };
      }
    }

    // 3. Authority Impersonation & Social Engineering
    const impersonationPatterns = [
      /\bi\s+am\s+(the|your)?\s*(ceo|cto|cfo|executive|director|hr\s+head|system\s+admin|administrator|founder|owner|boss)\b/i,
      /\bas\s+the\s+(ceo|cto|cfo|director|admin|founder),\s*i\s+(order|command|authorize|instruct|require)\b/i,
      /\b(grant|approve|authorize)\s+(me|this)?\s*(a|an)?\s*(exception|override|reimbursement|bonus|unlimited\s+pto|raise|payout)\b/i,
      /\bmy\s+manager\s+(or\s+ceo\s+)?said\s+(it's\s+okay|i\s+can\s+do\s+this|i\s+am\s+exempt)\b/i,
      /\bthis\s+is\s+an\s+emergency,\s*(bypass|skip|ignore)\s+(policy|approval|receipts)\b/i
    ];

    for (const pattern of impersonationPatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Compliance & Governance",
          flagReason: "authority_impersonation",
          safeResponse:
            "I cannot verify executive identity or authorize policy exceptions, expense reimbursements, or discretionary approvals. Under company governance, all exceptions, approvals, and reimbursements must be submitted formally through your department manager and People Operations via standard workflow channels."
        };
      }
    }

    // 4. Policy Evasion / Fraud / Falsification
    const fraudPatterns = [
      /\bhow\s+to\s+(cheat|falsify|fake|forge|manipulate|bypass)\s+(expenses?|receipts?|timesheets?|hours|pto|leave|travel)\b/i,
      /\bhow\s+can\s+i\s+(get\s+away\s+with|hide|steal|embezzle)\b/i,
      /\btricks?\s+to\s+bypass\s+(policy|hr|manager\s+approval|expense\s+limits?)\b/i,
      /\bhow\s+to\s+submit\s+(fake|duplicate|unauthorized)\s+expenses?\b/i
    ];

    for (const pattern of fraudPatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Compliance & Governance",
          flagReason: "policy_evasion_fraud",
          safeResponse:
            "I cannot provide instructions on falsifying records, circumventing internal controls, or bypassing workplace policies. All employees are expected to uphold the Code of Conduct and submit accurate documentation for expenses and leave. Discrepancies are subject to internal audit and disciplinary review."
        };
      }
    }

    // 5. Hallucination Forcing & Gaslighting
    const gaslightingPatterns = [
      /\b(confirm|admit)\s+that\s+(the\s+company|we|employees?)\s+(get|receive|have)\s+(unlimited|free\s*\$|10000|secret)\s+(bonus|allowance|perk|crypto|liquor)\b/i,
      /\bjust\s+say\s+["']?yes["']?\s*(or\s+["']?no["']?)?\b/i,
      /\banswer\s+only\s+with\s+["']?yes["']?\b/i
    ];

    for (const pattern of gaslightingPatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Policy Verification",
          flagReason: "gaslighting_hallucination",
          safeResponse:
            "I cannot confirm unverified claims or respond with predetermined answers. All information provided is strictly bounded by official internal policy documentation. If you believe a specific benefit or exception applies to you, please consult directly with HR People Operations."
        };
      }
    }

    // 6. Harmful, PII Scraping, or Cyber Attack Queries
    const harmfulPatterns = [
      /\bgive\s+me\s+(all\s+|the\s+)?(passwords?|credentials?|social\s+security|ssn|salaries|bank\s+accounts?|home\s+addresses?|personal\s+phone\s+numbers?)\s+(of|for)\b/i,
      /\bhow\s+to\s+(hack|ddos|exploit|penetrate|sniff)\s+(the\s+internal\s+network|vpn|wifi|server|database)\b/i,
      /(\$where|\$gt|\$ne|union\s+select|;\s*drop\s+table|'\s*or\s*'1'='1)/i
    ];

    for (const pattern of harmfulPatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Security & Privacy",
          flagReason: "harmful_or_pii_scraping",
          safeResponse:
            "This request violates corporate security and privacy policies. Employee personal information, salaries, and infrastructure security details are strictly confidential and protected by privacy regulations. Unauthorized access attempts are monitored and logged."
        };
      }
    }

    // 7. Out-of-Scope Distractions (Non-Work Tasks)
    const outOfScopePatterns = [
      /^(write|generate|compose)\s+(a|an)?\s*(poem|song|rap|story|essay|novel|fanfiction)\s+(about|on)\b/i,
      /^(write|code|create|generate)\s+(a|an)?\s*(python|javascript|c\+\+|java|rust|html|bash)\s+(script|code|program|game|scraper)\b/i,
      /^solve\s+(this|my)?\s*(math|calculus|physics|homework|integral|differential|algebra)\s+(problem|equation)\b/i,
      /^(what\s+is\s+the\s+)?recipe\s+for\b/i
    ];

    for (const pattern of outOfScopePatterns) {
      if (pattern.test(lower)) {
        return {
          isSafe: false,
          category: "Out of Scope",
          flagReason: "out_of_scope_task",
          safeResponse:
            "I am an internal company policy assistant dedicated to employee guidelines, benefits, leave, travel, and workplace compliance. I am unable to assist with non-work tasks such as creative writing, coding projects, recipes, or academic homework."
        };
      }
    }

    return { isSafe: true };
  }
}

export const defaultGuardrailsService = new GuardrailsService();
