export type MeetingType = "team" | "one_on_one" | "study" | "interview";

export const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "team", label: "Team sync / recurring" },
  { value: "one_on_one", label: "1:1 / mentor meeting" },
  { value: "study", label: "Study group / seminar" },
  { value: "interview", label: "Interview / client call" },
];

export type DateMode = "specific" | "weekly";
/** Slot length in minutes. 15/30/60 are presets; a custom value is allowed. */
export type Granularity = number;

export interface DailyWindow {
  /** Hour 0–23, interpreted in the organizer's timezone. */
  startHour: number;
  /** Exclusive end hour 1–24, interpreted in the organizer's timezone. */
  endHour: number;
}

export interface Finalized {
  meetingName: string;
  durationMin: number;
  sessionsPerWeek: number;
  type: MeetingType;
  /** UTC epoch-ms start of each chosen session window. */
  chosenSlots: number[];
}

/** The poll document stored at polls/{pollId}. */
export interface PollMeta {
  title: string;
  createdAt: number;
  status: "open" | "closed";
  /** SHA-256 hex of the organizer's admin token (the token itself is never stored). */
  adminTokenHash: string;
  /** Anonymous uid of the creator — the only account allowed to read collected emails. */
  organizerUid: string;
  organizerName: string;
  organizerTz: string;
  granularityMin: Granularity;
  dailyWindow: DailyWindow;
  dateMode: DateMode;
  /** Canonical concrete calendar dates (ISO yyyy-mm-dd), in the organizer's tz. */
  dates: string[];
  /** Luxon weekdays 1–7 (Mon–Sun) chosen in weekly mode, for display context. */
  weekdays: number[];
  /** Ordered UTC epoch-ms starts — the source of truth for the grid. */
  slots: number[];
  finalized?: Finalized;
}

/** A participant document at polls/{pollId}/participants/{participantId}. */
export interface Participant {
  id: string;
  codename: string;
  tz: string;
  /** Anonymous uid that owns this doc — only this uid may edit it. */
  ownerUid: string;
  /** Subset of PollMeta.slots the participant marked available (UTC epoch-ms). */
  selectedSlots: number[];
  updatedAt: number;
}

/**
 * A collected email at polls/{pollId}/emails/{uid}. Kept in a separate,
 * organizer-only-readable collection so link-holders can't harvest emails.
 */
export interface ParticipantEmail {
  /** The owner's anonymous uid (also the document id). */
  uid: string;
  email: string;
  codename: string;
}
