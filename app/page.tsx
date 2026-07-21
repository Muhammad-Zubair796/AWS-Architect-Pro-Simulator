"use client";
import { useState, useEffect } from "react";
import { phases, Command } from "../data/phases";
import CodeTester from "../components/CodeTester";
import ArchitectureVisualizer from "../components/ArchitectureVisualizer";
import { Terminal, Code, ArrowRight, ArrowLeft, Database, LayoutDashboard, PlayCircle, CheckCircle2, ChefHat, User, Clock, BookOpen, ChevronDown, ChevronUp } from "lucide-react";

type ExamRun = { date: string; score: number; maxScore: number; mode: string; timeTaken: number };
type UserProfile = { name: string; history: ExamRun[] };

export default function Home() {
  const [view, setView] = useState<"login" | "intro" | "simulator" | "dashboard">("login");
  const [usernameInput, setUsernameInput] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<{ [key: string]: UserProfile }>({});
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [mode, setMode] = useState<"cli" | "terraform">("cli");
  const [isStoryExpanded, setIsStoryExpanded] = useState(false);

  // INDEPENDENT STATES FOR CLI AND TERRAFORM
  const [cliInputs, setCliInputs] = useState<{ [key: string]: string }>({});
  const [tfInputs, setTfInputs] = useState<{ [key: string]: string }>({});
  const [cliScores, setCliScores] = useState<{ [key: string]: number }>({});
  const [tfScores, setTfScores] = useState<{ [key: string]: number }>({});
  const [cliAliasMap, setCliAliasMap] = useState<{ [key: string]: string }>({});
  const [tfAliasMap, setTfAliasMap] = useState<{ [key: string]: string }>({});
  const [activeInputId, setActiveInputId] = useState<string | null>(null);
  const [examTime, setExamTime] = useState(0);
  const [isExamRunning, setIsExamRunning] = useState(false);

  // Get active state based on current mode
  const activeInputs = mode === "cli" ? cliInputs : tfInputs;
  const activeScores = mode === "cli" ? cliScores : tfScores;
  const activeAliasMap = mode === "cli" ? cliAliasMap : tfAliasMap;

  useEffect(() => {
    const saved = localStorage.getItem("aws_users");
    if (saved) setAllUsers(JSON.parse(saved));
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isExamRunning) {
      interval = setInterval(() => setExamTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isExamRunning]);

  // Reset story expansion when phase changes
  useEffect(() => {
    setIsStoryExpanded(false);
  }, [currentPhaseIdx]);

  const handleLogin = () => {
    const name = usernameInput.trim().toLowerCase();
    if (!name) return;

    if (allUsers[name]) {
      setCurrentUser(allUsers[name]);
    } else {
      const newUser = { name, history: [] };
      const updatedUsers = { ...allUsers, [name]: newUser };
      setAllUsers(updatedUsers);
      setCurrentUser(newUser);
      localStorage.setItem("aws_users", JSON.stringify(updatedUsers));
    }
    setView("intro");
  };

  const startExam = () => {
    setCliInputs({}); setTfInputs({});
    setCliScores({}); setTfScores({});
    setCliAliasMap({}); setTfAliasMap({});
    setCurrentPhaseIdx(0);
    setExamTime(0);
    setIsExamRunning(true);
    setView("simulator");
  };

  const phase = phases[currentPhaseIdx];
  const commands = mode === "cli" ? phase.cli : phase.terraform;
  const currentPhaseScore = commands.reduce((sum, cmd) => sum + (activeScores[cmd.id] || 0), 0);
  const maxPhaseScore = commands.length;
  const totalPossibleScore = phases.reduce((sum, p) => sum + (mode === "cli" ? p.cli.length : p.terraform.length), 0);
  const overallScore = Object.values(activeScores).reduce((sum, val) => sum + val, 0);
  const progressPercentage = ((currentPhaseIdx + 1) / phases.length) * 100;

  const handleInputChange = (id: string, value: string, cmd: Command) => {
    const isCli = mode === "cli";
    const setInputs = isCli ? setCliInputs : setTfInputs;
    const setScores = isCli ? setCliScores : setTfScores;
    const setAliasMap = isCli ? setCliAliasMap : setTfAliasMap;
    const currentAliasMap = isCli ? cliAliasMap : tfAliasMap;

    setInputs(prev => ({ ...prev, [id]: value }));

    let newScore = 0;
    const cleanVal = value.trim();

    if (isCli && cmd.expected.includes("=$(")) {
      const userVarMatch = cleanVal.match(/^([A-Za-z0-9_]+)=\$\(/);
      const expectedVarName = cmd.expected.split("=")[0];
      
      if (userVarMatch) {
        const userVarName = userVarMatch[1];
        
        let processedVal = cleanVal;
        const entries = Object.entries(currentAliasMap).sort((a, b) => b[1].length - a[1].length);
        entries.forEach(([expVar, usrVar]) => {
          processedVal = processedVal.split(`$${usrVar}`).join(`$${expVar}`);
        });
        
        const testVal = processedVal.replace(new RegExp(`^${userVarName}=\\$\\(`), `${expectedVarName}=$(`);

        if ((cmd.regex && cmd.regex.test(testVal)) || testVal === cmd.expected.trim()) {
          newScore = 1;
          setAliasMap(prev => ({ ...prev, [expectedVarName]: userVarName }));
        } else if (cleanVal.length > 5 && cmd.expected.trim().includes(testVal)) {
          newScore = 0.5;
        }
      } else if (cmd.regex && cmd.regex.test(cleanVal)) {
        newScore = 1;
      }
    } else if (!isCli && cmd.expected.startsWith("resource")) {
      const userMatch = cleanVal.match(/^resource\s+"([^"]+)"\s+"([^"]+)"\s*\{$/);
      const expectedMatch = cmd.expected.match(/^resource\s+"([^"]+)"\s+"([^"]+)"\s*\{$/);
      
      if (userMatch && expectedMatch && userMatch[1] === expectedMatch[1]) {
        newScore = 1;
        setAliasMap(prev => ({ ...prev, [expectedMatch[2]]: userMatch[2] }));
      } else if (cmd.regex && cmd.regex.test(cleanVal)) {
        newScore = 1;
      }
    } else {
      let processedVal = cleanVal;
      const entries = Object.entries(currentAliasMap).sort((a, b) => b[1].length - a[1].length);
      
      entries.forEach(([expectedVar, userVar]) => {
        if (isCli) {
          processedVal = processedVal.split(`$${userVar}`).join(`$${expectedVar}`);
        } else {
          processedVal = processedVal.split(userVar).join(expectedVar);
        }
      });

      const cleanExp = cmd.expected.trim();
      
      if (cmd.regex && cmd.regex.test(processedVal)) {
        newScore = 1;
      } else if (processedVal === cleanExp) {
        newScore = 1;
      } else if (cleanVal.length > 5 && cleanExp.includes(processedVal)) {
        newScore = 0.5;
      }
    }

    setScores(prev => ({ ...prev, [id]: newScore }));
  };

  const insertVariable = (varName: string) => {
    if (!activeInputId) return;
    const currentVal = activeInputs[activeInputId] || "";
    const newVal = currentVal + (currentVal.endsWith(" ") || currentVal === "" ? "" : " ") + (mode === "cli" ? `$${varName}` : varName);
    const cmd = commands.find(c => c.id === activeInputId);
    if (cmd) handleInputChange(activeInputId, newVal, cmd);
  };

  const savedCliVariables = Object.values(cliAliasMap);

  const tfResources: { [key: string]: string } = {
    "tf-1-4": "aws_vpc.enterprise_vpc",
    "tf-2-1": "aws_subnet.public_subnet_1",
    "tf-2-6": "aws_subnet.public_subnet_2",
    "tf-2-11": "aws_subnet.private_app_subnet_1",
    "tf-2-16": "aws_subnet.private_app_subnet_2",
    "tf-2-21": "aws_subnet.private_db_subnet_1",
    "tf-2-26": "aws_subnet.private_db_subnet_2",
    "tf-3-1": "aws_internet_gateway.enterprise_igw",
    "tf-3-4": "aws_route_table.public_rt",
    "tf-4-1": "aws_security_group.alb_sg",
    "tf-4-11": "aws_security_group.app_sg",
    "tf-4-21": "aws_security_group.db_sg",
    "tf-5-1": "aws_db_subnet_group.enterprise_db_subnet_group",
    "tf-5-5": "aws_db_instance.enterprise_db",
    "tf-6-1": "aws_eip.nat_eip",
    "tf-6-4": "aws_nat_gateway.enterprise_nat",
    "tf-6-8": "aws_route_table.private_rt",
    "tf-7-1": "aws_iam_role.chef_role",
    "tf-7-20": "aws_iam_instance_profile.chef_profile",
    "tf-8-1": "aws_lb_target_group.enterprise_tg",
    "tf-8-7": "aws_lb.enterprise_alb",
    "tf-9-9": "aws_launch_template.enterprise_lt",
    "tf-9-27": "aws_autoscaling_group.enterprise_asg",
    "tf-12-1": "aws_cloudwatch_metric_alarm.high_cpu"
  };

  const declaredTfResources = Object.keys(tfResources).filter(id => tfScores[id] === 1).map(id => {
    let resName = tfResources[id];
    Object.entries(tfAliasMap).forEach(([expectedVar, userVar]) => {
      resName = resName.split(expectedVar).join(userVar);
    });
    return resName;
  });

  const finishExam = () => {
    setIsExamRunning(false);
    if (!currentUser) return;

    const newRun = { date: new Date().toLocaleString(), score: overallScore, maxScore: totalPossibleScore, mode, timeTaken: examTime };
    const updatedUser = { ...currentUser, history: [newRun, ...currentUser.history] };
    const updatedUsers = { ...allUsers, [currentUser.name]: updatedUser };

    setCurrentUser(updatedUser);
    setAllUsers(updatedUsers);
    localStorage.setItem("aws_users", JSON.stringify(updatedUsers));
    setView("dashboard");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <header className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-400" /> AWS Architect Pro
          </h1>
          {currentUser && view !== "login" && (
            <div className="flex gap-4 items-center">
              <div className="text-sm text-slate-400 flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-full">
                <User className="w-4 h-4" /> {currentUser.name}
              </div>
              <button onClick={() => setView("simulator")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === "simulator" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>
                <PlayCircle className="w-4 h-4" /> Simulator
              </button>
              <button onClick={() => setView("dashboard")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === "dashboard" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}>
                <LayoutDashboard className="w-4 h-4" /> My Progress
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        
        {view === "login" && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-2xl text-center mt-20">
            <User className="w-16 h-16 text-blue-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">Select Profile</h2>
            <p className="text-slate-400 mb-6 text-sm">Enter your name to load your workspace or create a new one.</p>
            <input 
              type="text" 
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="e.g. Zubair"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-500 text-center text-lg"
            />
            <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all">
              Enter Workspace
            </button>
          </div>
        )}

        {view === "intro" && (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-10 shadow-2xl text-center mt-10">
            <ChefHat className="w-20 h-20 text-blue-500 mx-auto mb-6" />
            <h2 className="text-4xl font-bold text-white mb-6">Welcome, {currentUser?.name}!</h2>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed text-left">
              Learning Cloud Architecture can be dry and confusing. To make it stick, we use the <b>Enterprise Restaurant Analogy</b>. 
              <br/><br/>
              Throughout this exam, you aren't just building servers; you are building a highly-available restaurant. 
              The <b>VPC</b> is your plot of land. The <b>Subnets</b> are your rooms (Lobby, Kitchen, Vault). The <b>EC2 Instances</b> are your Chefs, and the <b>Database</b> is your Master Ledger.
              <br/><br/>
              You will be graded on your exact syntax. If you get stuck, hints will appear after 10 seconds, partial answers after 30s, and full answers after 60s.
            </p>
            <button onClick={startExam} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl text-lg transition-all shadow-lg shadow-blue-900/50">
              Start the Exam
            </button>
          </div>
        )}

        {view === "dashboard" && currentUser && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white">{currentUser.name}'s Exam History</h2>
            {currentUser.history.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
                No exams completed yet. Go to the Simulator to start your first run!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {currentUser.history.map((run, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-xs font-mono text-slate-500">{run.date}</span>
                      <span className={`text-xs px-2 py-1 rounded uppercase font-bold ${run.mode === 'cli' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>{run.mode}</span>
                    </div>
                    <div className="text-4xl font-bold text-white mb-2">{run.score} <span className="text-lg text-slate-500">/ {run.maxScore}</span></div>
                    <div className="text-sm text-slate-400 mb-4 flex items-center gap-1"><Clock className="w-4 h-4"/> Time: {formatTime(run.timeTaken)}</div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(run.score / run.maxScore) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white">{phase.title}</h2>
                  <span className="text-sm text-slate-400">Phase {currentPhaseIdx + 1}/{phases.length}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercentage}%` }} />
                </div>
                
                {/* Expandable Story Panel */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
                  <button 
                    onClick={() => setIsStoryExpanded(!isStoryExpanded)}
                    className="w-full flex items-center justify-between p-4 text-slate-300 hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-400"/> The Story</span>
                    {isStoryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {isStoryExpanded && (
                    <div className="p-4 pt-0 text-slate-400 leading-relaxed text-sm border-t border-slate-800/50">
                      {phase.story.split('\n').map((paragraph, i) => (
                        <p key={i} className="mb-3 last:mb-0">{paragraph}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Live Architecture</h3>
                <ArchitectureVisualizer inputs={activeInputs} aliasMap={activeAliasMap} mode={mode} scores={activeScores} />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4" /> {mode === "cli" ? "Environment Inventory" : "Terraform State"}
                </h3>
                {mode === "cli" ? (
                  savedCliVariables.length === 0 ? (
                    <p className="text-sm text-slate-600 italic">No variables saved yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {savedCliVariables.map((v, i) => (
                        <button 
                          key={i} 
                          onClick={() => insertVariable(v)}
                          className="bg-emerald-900/30 border border-emerald-800 text-emerald-400 px-3 py-1.5 rounded-md text-sm font-mono flex items-center gap-2 shadow-inner hover:bg-emerald-800/50 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" /> {v}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  declaredTfResources.length === 0 ? (
                    <p className="text-sm text-slate-600 italic">No resources declared yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {declaredTfResources.map((res, i) => (
                        <div 
                          key={i} 
                          className="bg-purple-900/30 border border-purple-800 text-purple-400 px-3 py-1.5 rounded-md text-sm font-mono flex items-center gap-2 shadow-inner"
                        >
                          <CheckCircle2 className="w-3 h-3" /> {res}
                        </div>
                      ))}
                    </div>
                  ))
                }
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="flex justify-between items-center bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-lg">
                <div className="flex gap-1">
                  <button onClick={() => setMode("cli")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "cli" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>
                    <Terminal className="w-4 h-4" /> AWS CLI
                  </button>
                  <button onClick={() => setMode("terraform")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "terraform" ? "bg-purple-600 text-white shadow-md" : "text-slate-400 hover:text-white"}`}>
                    <Code className="w-4 h-4" /> Terraform
                  </button>
                </div>
                <div className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-medium flex gap-4 items-center">
                  <div className="flex items-center gap-1 text-slate-400"><Clock className="w-4 h-4"/> {formatTime(examTime)}</div>
                  <div className="border-l border-slate-700 pl-4">Phase: <span className={currentPhaseScore === maxPhaseScore ? "text-green-400" : "text-blue-400"}>{currentPhaseScore}</span>/{maxPhaseScore}</div>
                  <div className="border-l border-slate-700 pl-4">Overall: <span className="text-emerald-400">{overallScore}</span>/{totalPossibleScore}</div>
                </div>
              </div>

              <CodeTester 
                key={`${mode}-${phase.id}`} 
                commands={commands} 
                inputs={activeInputs}
                scores={activeScores}
                onInputChange={handleInputChange}
                onFocusChange={setActiveInputId}
                aliasMap={activeAliasMap}
                mode={mode}
              />

              <div className="flex justify-between pt-4">
                {currentPhaseIdx > 0 ? (
                  <button onClick={() => setCurrentPhaseIdx(currentPhaseIdx - 1)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Previous
                  </button>
                ) : <div />}
                
                {currentPhaseIdx === phases.length - 1 ? (
                  <button onClick={finishExam} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/20 font-bold">
                    Finish Exam <CheckCircle2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => setCurrentPhaseIdx(currentPhaseIdx + 1)} disabled={currentPhaseScore < maxPhaseScore} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-900/20">
                    Next Phase <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}