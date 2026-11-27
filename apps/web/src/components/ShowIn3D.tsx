import { type SceneHint, useSimStore } from '../simStore';

/** Dictionary-card button: scroll up to the simulation and open the term there. */
export function ShowIn3D({
  term,
  hint,
  label = 'Xem trên 3D',
}: {
  term: string;
  hint: SceneHint | undefined;
  label?: string;
}) {
  const open = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('sim')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    useSimStore.getState().openTerm(term, hint);
  };
  return (
    <button type="button" className="btn" onClick={open}>
      {label}
    </button>
  );
}
