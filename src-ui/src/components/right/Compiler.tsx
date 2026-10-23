// RightPanel.tsx — Right panel: full-height working-tree changes.
// .compiler-top wrapper styling lives in global.css (same selector,
// kept around because changing the wrapper class would touch every
// theme rule that scopes to it).

import { useAppState } from '../../store/app-state';
import { ChangesBoard } from './ChangesBoard';

export function RightPanel() {
  const { state } = useAppState();
  const selection = state.diffSelection;
  // Keep committed files from different commits distinct, matching ChangesBoard.
  const selectedPath = selection
    ? selection.kind === 'committed'
      ? `committed\x00${selection.commitHash ?? ''}\x00${selection.path}`
      : `${selection.kind}\x00${selection.path}`
    : null;
  return (
    <div className="compiler-top changes-board">
      <ChangesBoard selectedPath={selectedPath} diffMode={state.diffMode} />
    </div>
  );
}
