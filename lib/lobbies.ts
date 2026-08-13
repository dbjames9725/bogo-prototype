import fs from 'fs';
import path from 'path';

export interface Lobby {
  id: string;
  itemPrice: number;
  userA: {
    paymentIntentId: string;
    chargeAmount: number;
  };
  userB?: {
    paymentIntentId: string;
    chargeAmount: number;
  };
  status: 'WAITING_FOR_PARTNER' | 'COMPLETED' | 'CANCELLED'; // Added CANCELLED status
  createdAt: number;
  expiresAt: number; // Added expiration timestamp field
}

const filePath = path.join(process.cwd(), 'lobbies.json');

export function getLobbies(): Record<string, Lobby> {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}), 'utf-8');
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (err) {
    return {};
  }
}

export function saveLobbies(lobbies: Record<string, Lobby>) {
  fs.writeFileSync(filePath, JSON.stringify(lobbies, null, 2), 'utf-8');
}