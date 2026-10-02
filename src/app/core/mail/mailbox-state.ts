import { MailAccount, MailAnswer, MailboxState, MailboxStates } from './mail.types';

const unfetched = (account: MailAccount): MailboxState => ({
  account,
  report: null,
  isReading: false,
  problem: null,
});

/** Every inbox before its first report. */
export const UNFETCHED_STATES: MailboxStates = {
  icloud: unfetched('icloud'),
  gmail: unfetched('gmail'),
};

/**
 * Where an inbox stands after `answer`. A list already shown is kept when a
 * later read fails, with the reason beside it, so a refresh never blanks it.
 */
export function settled(state: MailboxState, answer: MailAnswer): MailboxState {
  const hasList = state.report?.state === 'listed';
  const done = { ...state, isReading: false };
  switch (answer.kind) {
    case 'absent':
      return done;
    case 'unreachable':
      return hasList ? { ...done, problem: 'api' } : { ...done, report: null, problem: 'api' };
    case 'report': {
      const { report } = answer;
      if (hasList && report.state === 'failed') return { ...done, problem: report.failure };
      return { ...done, report, problem: null };
    }
  }
}
