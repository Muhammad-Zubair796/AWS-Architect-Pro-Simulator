"use client";
import { useState, useEffect } from "react";
import { Command } from "../data/phases";
import { CheckCircle, AlertCircle, HelpCircle, KeyRound, Info, CornerDownRight, BookOpen } from "lucide-react";

export default function CodeTester({
  commands, inputs, scores, onInputChange, onFocusChange, aliasMap, mode
}: {
  commands: Command[],
  inputs: { [key: string]: string },
  scores: { [key: string]: number },
  onInputChange: (id: string, value: string, cmd: Command) => void,
  onFocusChange: (id: string) => void,
  aliasMap: { [key: string]: string },
  mode: "cli" | "terraform"
}) {
  const [hints, setHints] = useState<{ [key: string]: boolean }>({});
  const [partials, setPartials] = useState<{ [key: string]: boolean }>({});
  const [reveals, setReveals] = useState<{ [key: string]: boolean }>({});
  const [lastTyped, setLastTyped] = useState<{ [key: string]: number }>({});
  const [lineTimers, setLineTimers] = useState<{ [key: string]: number }>({});
  const [activeLine, setActiveLine] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      setLineTimers(prev => {
        const newTimers = { ...prev };
        Object.keys(lastTyped).forEach(id => {
          if (scores[id] !== 1) {
            newTimers[id] = (newTimers[id] || 0) + 1;
          }
        });
        return newTimers;
      });

      setHints(prev => {
        const newHints = { ...prev };
        Object.keys(lastTyped).forEach(id => {
          if (now - lastTyped[id] > 10000 && scores[id] !== 1) newHints[id] = true;
        });
        return newHints;
      });

      setPartials(prev => {
        const newPartials = { ...prev };
        Object.keys(lastTyped).forEach(id => {
          if (now - lastTyped[id] > 30000 && scores[id] !== 1) newPartials[id] = true;
        });
        return newPartials;
      });

      setReveals(prev => {
        const newReveals = { ...prev };
        Object.keys(lastTyped).forEach(id => {
          if (now - lastTyped[id] > 60000 && scores[id] !== 1) newReveals[id] = true;
        });
        return newReveals;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastTyped, scores]);

  const handleInput = (id: string, value: string, cmd: Command) => {
    setLastTyped(prev => ({ ...prev, [id]: Date.now() }));
    onInputChange(id, value, cmd);
  };

  const groupedCommands: { groupName: string, commands: Command[] }[] = [];
  let currentGroup = "";
  let currentCommands: Command[] = [];

  commands.forEach(cmd => {
    const gName = cmd.group || "";
    if (gName !== currentGroup) {
      if (currentCommands.length > 0) {
        groupedCommands.push({ groupName: currentGroup, commands: currentCommands });
      }
      currentGroup = gName;
      currentCommands = [cmd];
    } else {
      currentCommands.push(cmd);
    }
  });
  if (currentCommands.length > 0) {
    groupedCommands.push({ groupName: currentGroup, commands: currentCommands });
  }

  const getDynamicText = (text: string, isHint: boolean = false) => {
    if (!text) return text;
    let dynamic = text;
    const entries = Object.entries(aliasMap).sort((a, b) => b[0].length - a[0].length);
    
    entries.forEach(([expectedVar, userVar]) => {
      if (mode === "cli") {
        if (!isHint) {
          dynamic = dynamic.split(`$${expectedVar}`).join(`$${userVar}`);
          dynamic = dynamic.split(`${expectedVar}=`).join(`${userVar}=`);
        } else {
          dynamic = dynamic.split(expectedVar).join(userVar);
        }
      } else {
        dynamic = dynamic.split(expectedVar).join(userVar);
      }
    });
    return dynamic;
  };

  return (
    <div className="bg-slate-900 p-6 rounded-xl shadow-2xl font-mono text-sm text-green-400">
      {groupedCommands.map((group, gIdx) => (
        <div key={gIdx} className={group.groupName ? "bg-slate-800/80 border-2 border-slate-600 rounded-xl p-5 mb-6 shadow-lg transition-all" : "mb-6"}>
          {group.groupName && (
            <div className="text-blue-300 font-mono text-sm mb-5 font-bold flex items-center gap-2 border-b border-slate-700 pb-2">
              <span className="text-slate-500">#</span> {group.groupName}
            </div>
          )}
          
          {group.commands.map((cmd, index) => {
            const dynamicExpected = getDynamicText(cmd.expected);
            const dynamicHint = getDynamicText(cmd.hint, true);
            const isActive = activeLine === cmd.id;

            return (
              <div key={cmd.id} className="mb-6 last:mb-0">
                <div className="text-xs text-blue-400 mb-2 ml-10 flex items-center gap-2 opacity-80">
                  <CornerDownRight className="w-3 h-3" /> {cmd.task}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-4">L{commands.findIndex(c => c.id === cmd.id) + 1}</span>
                  <span className="text-gray-500">{">"}</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={inputs[cmd.id] || ""}
                      onChange={(e) => handleInput(cmd.id, e.target.value, cmd)}
                      onFocus={() => { 
                        onFocusChange(cmd.id);
                        setActiveLine(cmd.id);
                        if (!lastTyped[cmd.id]) setLastTyped(prev => ({ ...prev, [cmd.id]: Date.now() }));
                      }}
                      className={`w-full bg-gray-800 border ${isActive ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-700'} rounded px-3 py-2 pr-28 text-white focus:outline-none transition-all relative z-10 bg-transparent`}
                      placeholder={partials[cmd.id] && !reveals[cmd.id] && scores[cmd.id] !== 1 ? "" : "Type command here..."}
                      autoComplete="off"
                      spellCheck="false"
                    />
                    {/* FIXED OVERLAP: Added pr-28 to input above, and positioned this safely */}
                    {cmd.expected.endsWith("\\") && (
                      <div className="absolute right-3 top-2.5 text-slate-500 text-xs font-bold pointer-events-none z-20 bg-gray-800 pl-2">
                        \ (Continued)
                      </div>
                    )}
                    {partials[cmd.id] && !reveals[cmd.id] && scores[cmd.id] !== 1 && !inputs[cmd.id] && (
                      <div className="absolute top-2 left-3 text-gray-600 z-0 pointer-events-none">
                        {dynamicExpected.substring(0, Math.ceil(dynamicExpected.length / 3))}...
                      </div>
                    )}
                  </div>
                  
                  {scores[cmd.id] === 1 && <CheckCircle className="text-green-500 w-5 h-5" />}
                  {scores[cmd.id] === 0.5 && <AlertCircle className="text-yellow-500 w-5 h-5" />}
                  <span className="text-xs text-slate-600 w-8 text-right">{lineTimers[cmd.id] || 0}s</span>
                </div>

                {/* INTERACTIVE STORY PANEL */}
                {isActive && cmd.breakdown && (
                  <div className="mt-3 ml-10 p-4 rounded-lg bg-indigo-950/40 border border-indigo-900/50 text-indigo-200 text-xs leading-relaxed animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-2 text-indigo-400 font-bold uppercase tracking-wider">
                      <BookOpen className="w-4 h-4" /> The Story
                    </div>
                    <div className="space-y-2">
                      {cmd.breakdown.split('\n').map((line, i) => {
                        if (line.includes('->')) {
                          const [, desc] = line.split('->');
                          return (
                            <p key={i} className="text-indigo-200/90 italic">{desc.trim()}</p>
                          );
                        }
                        return <p key={i} className="text-indigo-200/90 italic">{line}</p>;
                      })}
                    </div>
                  </div>
                )}
                
                {hints[cmd.id] && scores[cmd.id] !== 1 && (
                  <div className={`mt-2 ml-10 flex items-center gap-2 p-2 rounded text-xs ${reveals[cmd.id] ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/20 text-blue-400'}`}>
                    {reveals[cmd.id] ? <KeyRound className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
                    <span>
                      {reveals[cmd.id] ? (
                        <><b>Answer:</b> <code className="bg-black/30 px-1.5 py-0.5 rounded ml-1 select-all">{dynamicExpected}</code></>
                      ) : (
                        <><b>Hint:</b> {dynamicHint}</>
                      )}
                    </span>
                  </div>
                )}

                {scores[cmd.id] === 1 && cmd.explanation && (
                  <div className="mt-2 ml-10 flex items-start gap-2 p-3 rounded text-xs bg-purple-900/20 text-purple-300 border border-purple-900/50 animate-in slide-in-from-top-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="leading-relaxed"><b>Theory:</b> {cmd.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}//components\CodeTester.tsx