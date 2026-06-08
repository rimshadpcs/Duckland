"use client";

import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Code2,
  GitBranch,
  Library,
  type LucideIcon,
  MessageCircleMore,
  Mic,
  Microscope,
  Moon,
  Paperclip,
  Play,
  Sparkles,
  Sun,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    title: "Upload your material",
    copy:
      "Drop in your lecture notes, slides, a PDF, a YouTube video, or just paste a link. Feynduck reads it so the feedback actually matches what your class covered.",
    icon: Upload,
  },
  {
    title: "Explain it to Feynduck",
    copy:
      "Pick a concept and explain it out loud — like you're telling a friend who's never heard of it. Don't worry about getting it perfect. That's the point.",
    icon: MessageCircleMore,
  },
  {
    title: "Fix the gap together",
    copy:
      "Feynduck tells you exactly where your explanation broke down or went wrong — where and why. Answer one follow-up question, then try again. That's the moment it actually clicks.",
    icon: Sparkles,
  },
];

const previewItems = [
  {
    title: "Upload notes",
    icon: Upload,
    description: "Anchor feedback to your actual notes.",
  },
  {
    title: "Explain out loud",
    icon: MessageCircleMore,
    description: "Teach the concept in your own words.",
  },
  {
    title: "Find the gap",
    icon: TriangleAlert,
    description: "See the exact step where your logic breaks.",
  },
  {
    title: "Practice weak spots",
    icon: Library,
    description: "Turn gaps into flashcards and drills.",
  },
  {
    title: "Track clarity",
    icon: GitBranch,
    description: "See what you can explain clearly.",
  },
];

type WorkspaceTab = "notes" | "gaps" | "cards" | "map";

const workspaceTabs: { id: WorkspaceTab; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "gaps", label: "Gaps" },
  { id: "cards", label: "Cards" },
  { id: "map", label: "Map" },
];

const tabForStep = (step: number): WorkspaceTab => {
  if (step === 2) return "gaps";
  if (step === 3) return "cards";
  if (step === 4) return "map";
  return "notes";
};

const audiences = [
  {
    title: "Exam-heavy students",
    copy: "You study hard, but freeze when the question asks “why?”",
    icon: ClipboardCheck,
  },
  {
    title: "Pre-med & science students",
    copy: "You memorize mechanisms, but need to explain causal chains clearly.",
    icon: Microscope,
  },
  {
    title: "CS & engineering students",
    copy: "You follow examples, but need to reason through the underlying logic.",
    icon: Code2,
  },
  {
    title: "Students using AI to study",
    copy: "You get summaries and answers, but still need to prove you understand them.",
    icon: Sparkles,
  },
];

const universities = [
  "Harvard",
  "Yale",
  "Princeton",
  "Columbia",
  "Brown",
  "Dartmouth",
  "Cornell",
  "UPenn",
  "MIT",
  "Stanford",
  "Caltech",
  "McGill",
  "UC Berkeley",
  "UCLA",
  "University of Toronto",
  "Oxford",
  "Cambridge",
];

const faqs = [
  {
    question: "What is the Feynman Technique?",
    answer:
      "The Feynman Technique is a learning method based on a simple idea: if you can't explain something clearly in plain language, you probably don't understand it yet. You choose a concept, explain it as if teaching someone else, find the gaps, then simplify it with clearer words and analogies.",
  },
  {
    question: "What is rubber ducking?",
    answer:
      "Rubber ducking comes from programming. Developers explain code step by step to a rubber duck to spot mistakes in their own logic. The duck doesn't need to answer. Explaining forces vague thinking into clear steps.",
  },
  {
    question: "Is Feynduck just another AI notes app?",
    answer:
      "No. Most AI study tools summarize your notes or answer questions for you. Feynduck makes you produce the explanation yourself, so you can test whether you actually understand it.",
  },
  {
    question: "Do I need to upload notes to use Feynduck?",
    answer:
      "No. You can explain any concept directly. Uploading notes, slides, or PDFs helps Feynduck evaluate your explanation against what your class actually covered.",
  },
  {
    question: "How is this different from flashcards?",
    answer:
      "Flashcards are good for recall. Feynduck is built for understanding. It checks whether you can explain why something happens, connect the steps, and apply the idea.",
  },
  {
    question: "Will Feynduck just give me the answer?",
    answer:
      "Not immediately. Feynduck guides you with better questions first, because fixing the gap yourself builds real understanding. It can still show a plain-English explanation after you've tried.",
  },
  {
    question: "Why use a duck?",
    answer:
      "The duck comes from rubber ducking: explaining something to a duck helps you hear your own thinking. Feynduck keeps that idea and adds AI so the duck can detect gaps and ask useful follow-ups.",
  },
];

type BillingCycle = "monthly" | "annual";
type ThemeMode = "light" | "obsidian";

const pricingTiers = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    intro: "Try one real Feynduck session",
    cta: "Start studying free",
    items: [
      "1 guided explanation session",
      "Upload 1 PDF, notes file, or pasted link",
      "Practice 1 concept from your material",
      "Basic gap feedback",
      "1 follow-up question per session",
      "Preview your first Clarity Score",
      "Upgrade to keep practicing",
    ],
  },
  {
    name: "Student",
    monthlyPrice: 12,
    annualPrice: 96,
    intro: "For students who study regularly",
    cta: "Start Student",
    badge: "Student favorite",
    featured: true,
    items: [
      "Unlimited explanations",
      "30 PDF uploads per month, up to 50 pages each",
      "Full gap analysis — all gaps ranked",
      "Unlimited follow-up questions",
      "Gap-based flashcards",
      "Clarity Score + session history",
      "5 active exams",
      "Topics extracted automatically from uploads",
    ],
  },
  {
    name: "Scholar",
    monthlyPrice: 20,
    annualPrice: 180,
    intro: "For med school, law, research",
    cta: "Start Scholar",
    badge: "Best value",
    items: [
      "Everything in Student",
      "Unlimited PDF uploads, up to 100 pages each",
      "Mastery Map across all exams",
      "Unlimited active exams",
      "Export gap reports and session notes",
      "Priority processing",
      "Early access to new features",
    ],
  },
];

function Duck({ className = "" }: { className?: string }) {
  return (
    <span className={`duck ${className}`} aria-label="Feynduck mascot" role="img">
      <img src="/feynduckhead.png" alt="" />
    </span>
  );
}

function SectionHeader({
  label,
  title,
  copy,
}: {
  label: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="section-header reveal">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

function UniversityMarquee() {
  const loop = [...universities, ...universities];

  return (
    <section className="university-strip reveal" aria-label="University social proof">
      <p>Loved by students from</p>
      <div className="university-marquee">
        <div className="university-track">
          {loop.map((school, index) => (
            <span key={`${school}-${index}`}>{school}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section faq-section" id="faq">
      <SectionHeader
        label="faq"
        title="Questions students usually ask."
        copy="Feynduck is built around explaining, not passive rereading. Here's how it works."
      />
      <div className="faq-list reveal">
        {faqs.map((item, index) => {
          const isOpen = openIndex === index;
          const answerId = `faq-answer-${index}`;

          return (
            <article className={`faq-item ${isOpen ? "open" : ""}`} key={item.question}>
              <button
                aria-controls={answerId}
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                type="button"
              >
                <span>{item.question}</span>
                <i aria-hidden="true" />
              </button>
              <div className="faq-answer" id={answerId}>
                <p>{item.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProductPreview() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [typedDuck, setTypedDuck] = useState("");
  const [typedUser, setTypedUser] = useState("");
  const [typedFollowup, setTypedFollowup] = useState("");
  const [gapVisible, setGapVisible] = useState(false);
  const [score, setScore] = useState(62);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("notes");
  const [fileReady, setFileReady] = useState(false);
  const [conceptCount, setConceptCount] = useState(0);
  const [gapItemsVisible, setGapItemsVisible] = useState(0);
  const [flashVisible, setFlashVisible] = useState(false);
  const [mapProgress, setMapProgress] = useState(0);
  const timeouts = useRef<number[]>([]);
  const isTyping = useRef(false);
  const selected = previewItems[active];
  const panelKickers = [
    "Start here",
    "Explain out loud",
    "Duck feedback",
    "Practice from gaps",
    "Track clarity",
  ];
  const clearDemoTimers = () => {
    timeouts.current.forEach((timer) => window.clearTimeout(timer));
    timeouts.current = [];
    isTyping.current = false;
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timeouts.current.push(timer);
  };

  const typeInto = (
    text: string,
    setter: (value: string) => void,
    delay = 55,
    variance = 0,
    onDone?: () => void,
  ) => {
    if (isTyping.current) return;
    isTyping.current = true;
    setter("");
    let index = 0;
    const tick = () => {
      index += 1;
      setter(text.slice(0, index));
      if (index >= text.length) {
        isTyping.current = false;
        onDone?.();
        return;
      }
      const jitter = variance ? Math.round((Math.random() * 2 - 1) * variance) : 0;
      schedule(tick, Math.max(8, delay + jitter));
    };
    schedule(tick, delay);
  };

  const restartDemo = () => {
    clearDemoTimers();
    setPaused(false);
    setActive(0);
    setTypedDuck("");
    setTypedUser("");
    setTypedFollowup("");
    setGapVisible(false);
    setScore(62);
    setActiveWorkspaceTab("notes");
    setFileReady(false);
    setConceptCount(0);
    setGapItemsVisible(0);
    setFlashVisible(false);
    setMapProgress(0);

    const duckPrompt =
      "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle.";
    const studentExplanation =
      "The Krebs cycle makes energy by breaking glucose down and passing electrons to carriers. Oxygen is needed later, so without oxygen the cycle just stops.";
    const duckFeedback = "That explains the topic, but not the cause.";

    const startMap = () => {
      setActive(4);
      setActiveWorkspaceTab("map");
      setTypedFollowup("");
      setGapVisible(false);
      setScore(62);
      setMapProgress(0);
      [1, 2, 3, 4].forEach((count, index) => schedule(() => setMapProgress(count), index * 200));
      const start = performance.now();
      const animate = (now: number) => {
        const progress = Math.min((now - start) / 1200, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setScore(Math.round(62 + (86 - 62) * eased));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      schedule(restartDemo, 3000);
    };

    const startCards = () => {
      setActive(3);
      setActiveWorkspaceTab("cards");
      setFlashVisible(false);
      setTypedFollowup("");
      schedule(() => setFlashVisible(true), 250);
      schedule(startMap, 2000);
    };

    const revealGapItems = () => {
      [1, 2, 3, 4, 5].forEach((count, index) => schedule(() => setGapItemsVisible(count), index * 300));
      schedule(startCards, 5 * 300 + 1000);
    };

    const startGap = () => {
      setTypedUser("");
      setActive(2);
      setActiveWorkspaceTab("gaps");
      setGapVisible(false);
      setGapItemsVisible(0);
      typeInto(duckFeedback, setTypedFollowup, 35, 0, () => {
        setGapVisible(true);
        revealGapItems();
      });
    };

    const startUserExplanation = () => {
      typeInto(studentExplanation, setTypedUser, 55, 15, () => schedule(startGap, 600));
    };

    schedule(() => {
      setFileReady(true);
      [1, 2, 3, 4].forEach((count, index) => schedule(() => setConceptCount(count), index * 200));
    }, 500);

    schedule(() => {
      setActive(1);
      setActiveWorkspaceTab("notes");
      typeInto(duckPrompt, setTypedDuck, 35, 10, () => schedule(startUserExplanation, 800));
    }, 2000);
  };

  useEffect(() => {
    restartDemo();
    return clearDemoTimers;
  }, []);

  const handlePreviewClick = (index: number) => {
    clearDemoTimers();
    setPaused(true);
    setActive(index);
    setGapVisible(index === 2);
    setScore(index === 4 ? 86 : 62);
    setActiveWorkspaceTab(tabForStep(index));
    setFileReady(true);
    setConceptCount(4);
    setGapItemsVisible(5);
    setFlashVisible(true);
    setMapProgress(4);
    setTypedDuck("");
    setTypedUser("");
    setTypedFollowup("");
  };

  const handleWorkspaceTabClick = (tab: WorkspaceTab) => {
    clearDemoTimers();
    setPaused(true);
    setActiveWorkspaceTab(tab);
    setFileReady(true);
    setConceptCount(4);
    setGapItemsVisible(5);
    setFlashVisible(true);
    setMapProgress(4);
  };

  return (
    <section className="section product-preview" id="preview">
      <SectionHeader
        label="product preview"
        title="See Feynduck in action."
        copy="Upload notes, explain out loud, find the gap, and track what you can actually explain."
      />
      <div className="preview-layout reveal">
        <div className="preview-tabs" aria-label="Product preview steps">
          {previewItems.map((item, index) => (
            <PreviewNavItem
              active={active === index}
              description={item.description}
              icon={item.icon}
              index={index}
              key={item.title}
              onClick={() => handlePreviewClick(index)}
              title={item.title}
            />
          ))}
        </div>

        <div className="demo-stage">
          <div className="browser-frame">
            <div className="browser-chrome">
              <div className="browser-dots"><span /><span /><span /></div>
              <div className="browser-tab"><Duck /> Krebs Cycle — Biology Midterm · Feynduck</div>
              <div className="browser-actions">
                <ChevronLeft size={15} />
                <ChevronRight size={15} />
              </div>
              <Bookmark size={15} />
            </div>
            <div className="product-shell">
              <div className="product-topbar">
                <div className="product-brand">
                  <Duck />
                  <strong>Feynduck</strong>
                </div>
                <div className="product-nav">
                  <span className="active">Home</span>
                  <span>My Exams</span>
                  <span>Progress</span>
                </div>
                <div className="product-actions">
                  <button className="product-ghost" type="button">↩ Explain again</button>
                  <button className="product-topbar-cta" type="button">🎤 Start explaining</button>
                </div>
              </div>
              {active !== 0 ? (
                <div className="context-strip">
                  <div className="context-path">
                    <span>My Exams</span>
                    <b>›</b>
                    <span>Biology Midterm</span>
                    <b>›</b>
                    <span>Krebs Cycle</span>
                  </div>
                  <div className="context-score">
                    <span>Clarity Score</span>
                    <strong>{score}</strong>
                    <i className="filled">●</i>
                    <i>○</i>
                    <i>○</i>
                  </div>
                </div>
              ) : null}
              <div className="product-body">
                <aside className="conversation-panel">
                  <div>
                    <span className="panel-kicker">{panelKickers[active]}</span>
                    <h3>{selected.title}</h3>
                    <p>Studying: Cellular Respiration · Source: Biology Lecture Week 4</p>
                  </div>
                  <span className="panel-divider" aria-hidden="true" />
                  <PreviewConversation
                    active={active}
                    typedDuck={typedDuck}
                    typedUser={typedUser}
                    typedFollowup={typedFollowup}
                    gapVisible={gapVisible}
                    score={score}
                  />
                  <div className={`input-zone ${typedUser ? "typing" : ""}`} aria-label="Explanation input preview">
                    <div className="study-composer">
                      <Paperclip className="composer-attach" size={16} aria-hidden="true" />
                      <div className={`composer-text ${typedUser ? "has-value" : ""}`}>
                        {typedUser || "Explain in your own words..."}
                      </div>
                      <button className="voice-button" type="button" aria-label="Speak explanation">
                        <Mic size={20} />
                      </button>
                    </div>
                    <button className="composer-retry" type="button">↩ explain again</button>
                  </div>
                </aside>

                <section className="workspace-panel" key={`workspace-${active}`}>
                  <PreviewWorkspace
                    activeTab={activeWorkspaceTab}
                    conceptCount={conceptCount}
                    fileReady={fileReady}
                    flashVisible={flashVisible}
                    gapItemsVisible={gapItemsVisible}
                    mapProgress={mapProgress}
                    onTabClick={handleWorkspaceTabClick}
                  />
                </section>
              </div>
            </div>
          </div>
          {paused ? (
            <button className="resume-demo" onClick={restartDemo} type="button">
              <Play size={14} />
              Resume demo
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PreviewNavItem({
  active,
  description,
  icon: Icon,
  index,
  onClick,
  title,
}: {
  active: boolean;
  description: string;
  icon: LucideIcon;
  index: number;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      aria-current={active ? "step" : undefined}
      className={active ? "active" : ""}
      onClick={onClick}
      type="button"
    >
      <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
      <span className="step-icon">
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="step-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function PreviewConversation({
  active,
  typedDuck,
  typedUser,
  typedFollowup,
  gapVisible,
  score,
}: {
  active: number;
  typedDuck: string;
  typedUser: string;
  typedFollowup: string;
  gapVisible: boolean;
  score: number;
}) {
  if (active === 0) {
    return (
      <div className="preview-chat">
        <p className="bubble duck-bubble with-duck">Upload what your class actually covered, and I&apos;ll use it to check your explanation.</p>
      </div>
    );
  }

  if (active === 2) {
    return (
      <div className="preview-chat">
        <p className="bubble student-bubble">Oxygen is needed for respiration, so I guess oxygen keeps it going.</p>
        {typedFollowup ? <p className="bubble duck-bubble">{typedFollowup}</p> : null}
      </div>
    );
  }

  if (active === 3) {
    return (
      <div className="preview-chat">
        <p className="bubble duck-bubble">Want to turn this gap into practice?</p>
      </div>
    );
  }

  if (active === 4) {
    return (
      <div className="preview-chat">
        <p className="bubble duck-bubble">You&apos;re getting clearer.</p>
      </div>
    );
  }

  return (
    <div className="preview-chat">
      <p className="bubble duck-bubble with-duck">{typedDuck || "Explain why the Krebs cycle needs oxygen, even though oxygen is not directly used in the cycle."}</p>
      {(typedFollowup || gapVisible) ? (
        <p className="bubble student-bubble">The Krebs cycle makes energy by breaking glucose down and passing electrons to carriers. Oxygen is needed later, so without oxygen the cycle just stops.</p>
      ) : null}
      {(typedFollowup || gapVisible) ? (
        <p className="bubble duck-bubble">{typedFollowup || "You're close. What happens to NADH if oxygen is unavailable?"}</p>
      ) : null}
      {gapVisible ? (
        <div className="gap-alert">
          <strong>Gap detected · Clarity {score}</strong>
          <p>You explained what happens but not why it stops. The causal link is missing.</p>
        </div>
      ) : null}
    </div>
  );
}

function PreviewWorkspace({
  activeTab,
  conceptCount,
  fileReady,
  flashVisible,
  gapItemsVisible,
  mapProgress,
  onTabClick,
}: {
  activeTab: WorkspaceTab;
  conceptCount: number;
  fileReady: boolean;
  flashVisible: boolean;
  gapItemsVisible: number;
  mapProgress: number;
  onTabClick: (tab: WorkspaceTab) => void;
}) {
  const [answerVisible, setAnswerVisible] = useState(false);
  const [markedDifficult, setMarkedDifficult] = useState(false);
  const concepts = ["Glycolysis", "Krebs Cycle", "Electron Transport Chain", "ATP Synthase"];
  const gaps = [
    <span key="causal"><strong>Missing causal link:</strong> NADH → ETC → NAD+ regeneration</span>,
    <span key="jargon"><strong>Jargon used as shortcut:</strong> “energy”</span>,
    <span key="analogy"><strong>Needs analogy:</strong> battery handoff / recycling carrier</span>,
    <span key="accuracy"><strong>Factual accuracy:</strong> mostly correct</span>,
    <span key="score"><strong>Clarity Score:</strong> 62</span>,
  ];

  useEffect(() => {
    if (activeTab === "cards") {
      setAnswerVisible(false);
      setMarkedDifficult(false);
    }
  }, [activeTab]);

  return (
    <>
      <div className="workspace-tabbar" role="tablist" aria-label="Study workspace">
        {workspaceTabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="workspace-content">
        {activeTab === "notes" ? (
          <>
            <div className="upload-card">
              <strong>Upload material</strong>
              {fileReady ? <span className="pop-chip">Cellular Respiration.pdf</span> : <em>Drop PDF here</em>}
              <small>Attach to: Biology Midterm</small>
            </div>
            <div className="workspace-card">
              <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
              <h4>Detected topics</h4>
              <div className="concept-pills">
                {concepts.slice(0, conceptCount).map((concept) => (
                  <span className="pop-chip" key={concept}>{concept}</span>
                ))}
              </div>
              <button type="button">Start explaining →</button>
            </div>
          </>
        ) : null}

        {activeTab === "gaps" ? (
          <div className="workspace-card">
            <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
            <h4>Gap Analysis</h4>
            <ul className="gap-list">
              {gaps.slice(0, gapItemsVisible).map((gap, index) => (
                <li className="fade-item" key={index}>{gap}</li>
              ))}
            </ul>
            <button type="button">Fix this gap →</button>
          </div>
        ) : null}

        {activeTab === "cards" ? (
          <div className="workspace-card flashcard-card">
            <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
            <h4>Flashcards</h4>
            <p>24 cards from weak spots</p>
            <div className={`flashcard revealed ${flashVisible ? "slide-in" : "pre-slide"}`}>
              <strong>What happens to NADH when oxygen is unavailable?</strong>
              <em className={answerVisible ? "" : "hidden-answer"}>
                {answerVisible ? "NADH cannot unload electrons, so NAD+ is not regenerated." : "Answer hidden"}
              </em>
            </div>
            <div className="card-actions">
              <button onClick={() => setAnswerVisible((value) => !value)} type="button">
                {answerVisible ? "Hide answer" : "Show answer"}
              </button>
              <button
                className={markedDifficult ? "selected" : ""}
                onClick={() => setMarkedDifficult((value) => !value)}
                type="button"
              >
                {markedDifficult ? "Marked difficult" : "Mark difficult"}
              </button>
              <button type="button">Review cards</button>
            </div>
          </div>
        ) : null}

        {activeTab === "map" ? (
          <div className="workspace-card">
            <span>BIOLOGY MIDTERM · KREBS CYCLE</span>
            <h4>Clarity Map</h4>
            <div className="clarity-map" aria-label="Concept clarity map">
              <span className={mapProgress >= 1 ? "ready" : ""}>Glycolysis <b>●</b></span>
              <i />
              <span className={mapProgress >= 2 ? "ready" : ""}>Krebs Cycle <b>◐</b></span>
              <i className="weak" />
              <span className={mapProgress >= 3 ? "ready" : ""}>Electron Transport Chain <b>○</b></span>
              <i className="weak" />
              <span className={mapProgress >= 4 ? "ready" : ""}>Synthesis <b>○</b></span>
            </div>
            <div className="legend">
              <span>● Clear</span>
              <span>◐ Improving</span>
              <span>○ Gap detected</span>
              <span>Dashed = weak link</span>
            </div>
            <div className="mini-score">Clarity Score: <strong>86</strong></div>
            <button type="button">Review weak links →</button>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function Home() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("feynduck-theme") === "obsidian" ? "obsidian" : "light";
  });

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("feynduck-theme", themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((current) => (current === "obsidian" ? "light" : "obsidian"));
  };

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#top" aria-label="Feynduck home">
          <Duck />
          <span>Feynduck Ai</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#method">The method</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="nav-actions">
          <button
            aria-label={
              themeMode === "obsidian"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            aria-pressed={themeMode === "obsidian"}
            className="theme-icon-switch"
            onClick={toggleTheme}
            type="button"
          >
            {themeMode === "obsidian" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a className="nav-cta" href="/study">
            Study with funny duck →
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy reveal">
          <h1>You&apos;ve studied for hours. You still can&apos;t explain it.</h1>
          <p>
            Feynduck combines the Feynman Technique and rubber ducking into an AI-powered
            study loop. Explain what you studied, discover where your reasoning breaks,
            and rebuild the explanation until it finally clicks.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/study">
              Study with funny duck →
            </a>
            <a className="button secondary" href="#how">
              See how it works
            </a>
          </div>
        </div>

        <div className="hero-illustration reveal">
          <img
            src={themeMode === "obsidian" ? "/feynduck_hero_dark.png" : "/feynduck_hero.png"}
            alt="Feynduck AI study companion hero illustration"
          />
        </div>
      </section>

      <UniversityMarquee />

      <section className="section method-banner" id="method">
        <SectionHeader
          label="the method"
          title="Why Feynduck works."
          copy="Feynman Technique helps you explain. Rubber ducking helps you hear the gap. Feynduck helps you fix it."
        />        <div className="method-card reveal" aria-label="Feynman Technique, Rubber Ducking, and Feynduck definitions">
          <article>
            <h3>feynman technique</h3>
            <p className="phonetic">/fyn-man tek-neek/ · noun</p>
            <div className="method-rule" />
            <p className="part">definition.</p>
            <blockquote>
              A learning method built around one test: can you explain a concept in plain language,
              as if teaching it to someone who knows nothing? If you stumble, that stumble is the gap.
            </blockquote>
            <p className="method-meta">named after · Richard Feynman</p>
            <p className="see-also">see also · active recall, teaching to learn</p>
          </article>
          <article>
            <h3>rubber ducking</h3>
            <p className="phonetic">/rub-er duk-ing/ · noun</p>
            <div className="method-rule" />
            <p className="part">definition.</p>
            <blockquote>
              The act of explaining a problem step by step to an object. The duck never responds.
              The explaining forces vague thinking into clear steps.
            </blockquote>
            <p className="method-meta">origin · The Pragmatic Programmer</p>
            <p className="see-also">see also · self-explanation, metacognition</p>
          </article>
          <article className="feynduck-definition">
            <h3>feynduck</h3>
            <p className="phonetic">/feyn-duk/ · noun</p>
            <div className="method-rule" />
            <p className="part">definition.</p>
            <blockquote>
              The duck that talks back. An AI study companion that makes you explain a concept in
              your own words, finds where your reasoning breaks, and asks the one question that helps
              you fix it yourself.
            </blockquote>
            <p className="see-also">see also · understanding, not memorisation</p>
          </article>
        </div>
        <div className="method-banner-image reveal">
          <img
            src={themeMode === "obsidian" ? "/wide_banner_dark.png" : "/wide_banner.png"}
            alt="Feynduck workflow diagram"
          />
        </div>
      </section>

      <section className="section how" id="how">
        <SectionHeader
          label="how it works"
          title="Explain it to Feynduck. Find out what you actually know."
          copy="No passive rereading. No pretending a highlighted paragraph means you learned it."
        />        <div className="steps">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div className="step-item reveal" key={step.title}>
                <span className="step-card-label">Step {index + 1}</span>
                <article className="step-card">
                  <span className="step-card-icon">
                    <StepIcon size={22} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              </div>
            );
          })}
        </div>
      </section>

      <ProductPreview />

      <section className="quality-proof section">
        <SectionHeader
          label="the moment it clicks"
          title="One session can turn vague recognition into a real explanation."
        />
        <div className="proof-grid reveal">
          <article className="proof-card before">
            <span>Before</span>
            <p>
              “The Krebs cycle makes ATP and oxygen is needed for respiration, so I guess oxygen
              keeps it going.”
            </p>
            <small>Sounds right. Feels complete. Clarity Score: 34.</small>
          </article>
          <article className="proof-card after">
            <span>After one session with Feynduck</span>
            <p>
              “The Krebs cycle doesn&apos;t use oxygen directly — but it produces NADH, which carries
              electrons to the transport chain. Oxygen sits at the end of that chain accepting those
              electrons. No oxygen means NADH can&apos;t offload, NAD+ runs out, and the Krebs cycle has
              nothing left to work with. It doesn&apos;t stop because of oxygen — it stops because of what
              oxygen&apos;s absence causes downstream.”
            </p>
            <small>Same student. A few minutes later. Clarity Score: 87.</small>
          </article>
        </div>
      </section>

      <section className="section audience-section">
        <SectionHeader
          label="who it's for"
          title="Built for students who can't afford fake confidence."
          copy="Feynduck is for students who put in the hours but still feel unsure when they have to explain, reason, or apply the material."
        />
        <div className="audience-grid reveal">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            return (
              <article className="audience-card" key={audience.title}>
                <span>
                  <Icon size={18} />
                </span>
                <h3>{audience.title}</h3>
                <p>{audience.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section pricing" id="pricing">
        <SectionHeader
          label="pricing"
          title="Start free. Upgrade when Feynduck becomes your study habit."
          copy="Try the explanation loop for free. Upgrade when you want unlimited practice, deeper gap feedback, and study history across subjects."
        />

        <div className="pricing-toggle reveal">
          <button
            className={billingCycle === "monthly" ? "active" : ""}
            onClick={() => setBillingCycle("monthly")}
            type="button"
          >
            Monthly
          </button>
          <button
            className={billingCycle === "annual" ? "active" : ""}
            onClick={() => setBillingCycle("annual")}
            type="button"
          >
            Annual
          </button>
        </div>

        <div className="pricing-grid">
          {pricingTiers.map((plan) => {
            const isAnnual = billingCycle === "annual";
            const price =
              isAnnual && plan.annualPrice > 0
                ? Math.floor(plan.annualPrice / 12)
                : plan.monthlyPrice;

            const savings = plan.monthlyPrice * 12 - plan.annualPrice;

            return (
              <article
                className={`price-card reveal ${plan.featured ? "featured" : ""} ${plan.badge && !plan.featured ? "value-card" : ""}`}
                key={plan.name}
              >
                {plan.badge ? <strong className="badge">{plan.badge}</strong> : null}
                <h3>{plan.name}</h3>
                <p className="price-intro">{plan.intro}</p>

                <div className="price">
                  ${price}
                  <span>/ month</span>
                </div>

                {plan.annualPrice > 0 && (
                  <p className="price-savings">
                    {isAnnual
                      ? `billed $${plan.annualPrice}/year — save $${savings}`
                      : `or $${plan.annualPrice}/year — save $${savings}`}
                  </p>
                )}

                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>
                      <Check size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a className="button primary" href="#top">
                  {plan.cta}
                </a>
              </article>
            );
          })}
        </div>

        <p className="pricing-footer reveal">
          The cost of one tutoring session. Lasts all year.
        </p>
      </section>

      <FAQSection />

      <section className="final-cta reveal">
        <Duck />
        <h2>Stop guessing whether you understand.</h2>
        <p>Explain it to Feynduck and find out before the exam does.</p>
        <a className="button primary" href="/study">
          Study with funny duck →
        </a>
      </section>

      <footer className="footer">
        <a className="brand" href="#top">
          <Duck />
          <span>Feynduck Ai</span>
        </a>
        <p>The study buddy that asks, “but why?” in the nicest possible way.</p>
        <div>
          <button
            aria-label={
              themeMode === "obsidian"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            aria-pressed={themeMode === "obsidian"}
            className="theme-switch"
            onClick={toggleTheme}
            type="button"
          >
            {themeMode === "obsidian" ? <Sun size={15} /> : <Moon size={15} />}
            <span>{themeMode === "obsidian" ? "Light mode" : "Dark mode"}</span>
          </button>
          <a href="#top">Privacy</a>
          <a href="#top">Terms</a>
          <a href="#top">Contact</a>
        </div>
      </footer>
    </main>
  );
}
