/** What the Inbox's Mark as read buttons change on GitHub, and nothing else. */
export interface InboxMarker {
  /** Marks one notification thread read. */
  markThreadRead(threadId: string): Promise<void>;
  /** Marks every notification updated up to `lastReadAt` read, so one that came after stays unread. */
  markAllRead(lastReadAt: string): Promise<void>;
}

/** The REST path of the account's notifications, from below the API's root. */
export const NOTIFICATIONS_PATH = 'notifications';

/** The REST path of one notification thread, from below the API's root. */
export const threadPath = (threadId: string): string => `notifications/threads/${threadId}`;
