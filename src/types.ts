// Type definitions for the application
export interface Slot {
  start: Date;
  end: Date;
  resourceId: string;
  price2h?: number;
}

export interface PollOption {
  text: string;
  voter_count?: number;
  price2h?: number;
}

export interface VoterInfo {
  userId: number;
  name: string;
  username?: string;
  optionIds: number[];
  votedAt: number;
}

export interface SentSummary {
  messageId: number;
  chatId: string;
  text: string;
  users: {
    userId: number;
    name: string;
    username?: string;
    total: number;
    paid: boolean;
  }[];
  timestamp: number;
}

export interface SentLineup {
  messageId: number;
  chatId: string;
  text: string;
  optionIndex: number;
  timestamp: number;
}

export interface ActivePoll {
  id: string;
  messageId: number;
  question: string;
  options: PollOption[];
  totalVoterCount?: number;
  createdAt: number;
  isStopped?: boolean;
  voterAnswers?: { [userId: number]: VoterInfo };
  optionVoterOrder?: { [optionId: number]: number[] };
  sentSummaries?: SentSummary[];
  sentLineups?: SentLineup[];
}

export interface MergedSlot {
  dateStr: string;
  date: Date;
  start: Date;
  end: Date;
  resourceName: string;
  price2h?: number;
  isSkipped?: boolean;
}
