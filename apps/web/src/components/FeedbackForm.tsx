import { createFeedbackSchema, type FeedbackKind } from '@atlas/contracts';
import { type FormEvent, useState } from 'react';
import { sendFeedback } from '../api';

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'error', label: 'Nội dung sai' },
  { value: 'unclear', label: 'Khó hiểu' },
  { value: 'suggestion', label: 'Góp ý' },
];

/** Anonymous by design: there is no name or email field (ADR 0008). */
export function FeedbackForm({ injurySlug }: { injurySlug: string }) {
  const [kind, setKind] = useState<FeedbackKind>('unclear');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = createFeedbackSchema.safeParse({ injurySlug, kind, message });
    if (!parsed.success) {
      setState({ kind: 'error', message: 'Hãy viết ít nhất 10 ký tự.' });
      return;
    }
    setState({ kind: 'sending' });
    try {
      await sendFeedback(parsed.data);
      setMessage('');
      setState({ kind: 'sent' });
    } catch {
      setState({ kind: 'error', message: 'Chưa gửi được. Hãy thử lại sau.' });
    }
  }

  return (
    <form className="feedback" onSubmit={submit}>
      <fieldset>
        <legend>Bạn muốn báo điều gì?</legend>
        {KINDS.map((k) => (
          <label key={k.value}>
            <input
              type="radio"
              name="kind"
              value={k.value}
              checked={kind === k.value}
              onChange={() => setKind(k.value)}
            />
            {k.label}
          </label>
        ))}
      </fieldset>
      <label htmlFor="feedback-message">
        Nội dung (ẩn danh, đừng ghi thông tin sức khỏe cá nhân)
      </label>
      <textarea
        id="feedback-message"
        rows={4}
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="submit" disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Đang gửi…' : 'Gửi góp ý'}
      </button>
      <p role="status">
        {state.kind === 'sent' && 'Đã nhận. Cảm ơn bạn.'}
        {state.kind === 'error' && state.message}
      </p>
    </form>
  );
}
