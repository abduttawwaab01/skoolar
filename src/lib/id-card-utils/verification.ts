import crypto from 'crypto';

export interface VerificationResult {
  valid: boolean;
  status: 'active' | 'expired' | 'suspended' | 'replaced' | 'not_found';
  message: string;
  cardData?: {
    uuid: string;
    fullName: string;
    displayId: string;
    personType: string;
    schoolName: string;
    issueDate: string;
    expiryDate?: string | null;
  };
}

export function generateValidationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function validateToken(
  token: string,
  storedToken: string,
  tokenPrefix: string
): boolean {
  if (!token || !storedToken) return false;
  return storedToken.startsWith(tokenPrefix);
}

export function buildVerificationResponse(
  card: {
    uuid: string;
    fullName: string;
    displayId: string;
    personType: string;
    status: string;
    issueDate: Date;
    expiryDate?: Date | null;
    school?: { name: string } | null;
  } | null
): VerificationResult {
  if (!card) {
    return {
      valid: false,
      status: 'not_found',
      message: 'No ID card found with this identifier.',
    };
  }

  const now = new Date();

  if (card.status === 'suspended') {
    return {
      valid: false,
      status: 'suspended',
      message: 'This ID card has been suspended and is no longer valid.',
      cardData: {
        uuid: card.uuid,
        fullName: card.fullName,
        displayId: card.displayId,
        personType: card.personType,
        schoolName: card.school?.name || 'Unknown School',
        issueDate: card.issueDate.toISOString().split('T')[0],
        expiryDate: card.expiryDate?.toISOString().split('T')[0],
      },
    };
  }

  if (card.status === 'replaced') {
    return {
      valid: false,
      status: 'replaced',
      message: 'This ID card has been replaced by a newer version.',
      cardData: {
        uuid: card.uuid,
        fullName: card.fullName,
        displayId: card.displayId,
        personType: card.personType,
        schoolName: card.school?.name || 'Unknown School',
        issueDate: card.issueDate.toISOString().split('T')[0],
        expiryDate: card.expiryDate?.toISOString().split('T')[0],
      },
    };
  }

  if (card.expiryDate && new Date(card.expiryDate) < now) {
    return {
      valid: false,
      status: 'expired',
      message: 'This ID card has expired.',
      cardData: {
        uuid: card.uuid,
        fullName: card.fullName,
        displayId: card.displayId,
        personType: card.personType,
        schoolName: card.school?.name || 'Unknown School',
        issueDate: card.issueDate.toISOString().split('T')[0],
        expiryDate: card.expiryDate.toISOString().split('T')[0],
      },
    };
  }

  return {
    valid: true,
    status: 'active',
    message: 'This ID card is valid and active.',
    cardData: {
      uuid: card.uuid,
      fullName: card.fullName,
      displayId: card.displayId,
      personType: card.personType,
      schoolName: card.school?.name || 'Unknown School',
      issueDate: card.issueDate.toISOString().split('T')[0],
      expiryDate: card.expiryDate?.toISOString().split('T')[0],
    },
  };
}
