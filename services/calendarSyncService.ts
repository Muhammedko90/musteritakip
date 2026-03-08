import { Note } from '../types';

export interface CalendarSyncService {
  pushEvent(note: Note): Promise<string | null>;
  pullEvents(): Promise<Note[]>;
  linkNoteToEventId(noteId: number, externalId: string): Promise<void>;
}

// Placeholder implementation for future Google/Outlook integration.
// Currently, these functions are no-ops to prepare the architecture.
export const calendarSyncService: CalendarSyncService = {
  async pushEvent(_note: Note): Promise<string | null> {
    // In the future, create/update an event in Google/Outlook and return its ID.
    return null;
  },
  async pullEvents(): Promise<Note[]> {
    // In the future, read events from external calendar and map them to Note objects.
    return [];
  },
  async linkNoteToEventId(_noteId: number, _externalId: string): Promise<void> {
    // In the future, persist link between local note and external calendar event.
  },
};

