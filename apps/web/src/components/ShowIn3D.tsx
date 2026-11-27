import { type SceneHint, useSimStore } from '../simStore';

/** Dictionary-card button: jump up to the simulation and open the term there. */
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
    // Jump, do not smooth-scroll: the simulation is several screens of text away, and a smooth
    // scroll has to paint every one of them. On CI's software rendering that stalled the page
    // for ~5 s (PR #62); weak phones pay the same cost.
    document.getElementById('sim')?.scrollIntoView();
    useSimStore.getState().openTerm(term, hint);
  };
  return (
    <button type="button" className="btn" onClick={open}>
      {label}
    </button>
  );
}
