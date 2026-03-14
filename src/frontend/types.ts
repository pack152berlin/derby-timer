export interface Event {
  id: string;
  name: string;
  date: string;
  lane_count: number;
  racer_count: number;
  organization: string;
  status: 'draft' | 'checkin' | 'racing' | 'complete';
  created_at: string;
  updated_at: string;
}

export interface EventAward {
  id: string;
  event_id: string;
  name: string;
  allow_second: boolean;
  allow_third: boolean;
  sort_order: number;
}

export interface EventAwardWinner {
  id: string;
  award_id: string;
  racer_id: string;
  place: number;
  award_name: string;
  racer_name: string;
}

export interface Racer {
  id: string;
  event_id: string;
  name: string;
  den: string | null;
  car_number: string;
  weight_ok: number;
  inspected_at: string | null;
  car_photo_filename: string | null;
  car_photo_mime_type: string | null;
  car_photo_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export interface HeatLane {
  id: string;
  heat_id: string;
  lane_number: number;
  racer_id: string;
  car_number?: string;
  racer_name?: string;
}

export interface Heat {
  id: string;
  event_id: string;
  round: number;
  heat_number: number;
  status: 'pending' | 'running' | 'complete';
  started_at: string | null;
  finished_at: string | null;
  lanes?: HeatLane[];
  results?: HeatResult[];
}

export interface Standing {
  racer_id: string;
  car_number: string;
  racer_name: string;
  wins: number;
  losses: number;
  heats_run: number;
  avg_time_ms: number | null;
}

export interface HeatResult {
  lane_number: number;
  racer_id: string;
  place: number;
  dnf?: boolean;
  time_ms?: number | null;
}

export interface RacerHistoryEntry {
  id: string;
  heat_id: string;
  lane_number: number;
  racer_id: string;
  place: number | null;
  time_ms: number | null;
  dnf: boolean;
  round: number;
  heat_number: number;
  created_at: string;
  updated_at: string;
}
