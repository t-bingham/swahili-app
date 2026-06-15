import { useState } from 'react';
import { ALL_NOUN_CLASSES, NOUN_CLASS_INFO } from '../data/nounClasses';

// Collapsible noun-class overview shown at the top of the Grammar tab. Swahili's
// noun-class system is the central learner challenge, so a always-available
// reference chart (semantic grouping + sg/pl + verb concord) supports the
// generative concord practice in the Learn screen.
export default function NounClassReference() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700 rounded-xl bg-slate-800/50">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-slate-200">🧩 Noun-class reference</span>
        <span className="text-slate-500 text-xs" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="py-1 px-2 font-medium">Class</th>
                <th className="py-1 px-2 font-medium">Sing / Plur</th>
                <th className="py-1 px-2 font-medium">Verb sg / pl</th>
                <th className="py-1 px-2 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {ALL_NOUN_CLASSES.map(c => {
                const i = NOUN_CLASS_INFO[c];
                return (
                  <tr key={c} className="border-t border-slate-700/50 align-top">
                    <td className="py-1.5 px-2">
                      <div className="font-semibold text-slate-200">{i.label}</div>
                      <div className="text-slate-500">{i.desc}</div>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap">{i.sg} / {i.pl}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap">{i.verbSg} / {i.verbPl}</td>
                    <td className="py-1.5 px-2 text-slate-400 whitespace-nowrap">{i.example}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
