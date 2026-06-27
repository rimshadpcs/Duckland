import {
  ClipboardCheck,
  Code2,
  GitBranch,
  Library,
  MessageCircleMore,
  Microscope,
  Sparkles,
  FileText,
  Link2,
  TriangleAlert,
  Upload,
} from "lucide-react";

export const steps = [
  {
    title: "Create a study room",
    copy: "Set up a space for an exam, lecture, paper, or topic.",
    icon: Library,
  },
  {
    title: "Add source material",
    copy: "Bring in PDFs, PPTs, notes, or other material Feynduck should use as context.",
    icon: FileText,
  },
  {
    title: "Explain what you understand",
    copy: "Teach the concept in your own words with text or speech.",
    icon: MessageCircleMore,
  },
  {
    title: "Find the missing link",
    copy: "See the exact step where your reasoning breaks.",
    icon: TriangleAlert,
  },
  {
    title: "Re-explain until clear",
    copy: "Answer one targeted question and rebuild the explanation.",
    icon: Sparkles,
  },
];

export const previewItems = [
  {
    title: "Add source material",
    icon: Upload,
    description: "Anchor feedback to your actual notes.",
  },
  {
    title: "Explain what you understand",
    icon: MessageCircleMore,
    description: "Teach the concept in your own words.",
  },
  {
    title: "Find the missing link",
    icon: TriangleAlert,
    description: "See the exact step where your reasoning breaks.",
  },
  {
    title: "Re-explain the weak spot",
    icon: Library,
    description: "Use one targeted question to rebuild the missing reasoning step.",
  },
  {
    title: "Track clarity",
    icon: GitBranch,
    description: "See what you can explain clearly.",
  },
  {
    title: "Build from your gaps",
    icon: Sparkles,
    description: "Turn the parts you could not explain into focused study tools.",
  },
];

export type WorkspaceTab = "notes" | "gaps" | "cards" | "map";

export const workspaceTabs: { id: WorkspaceTab; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "gaps", label: "Gaps" },
  { id: "cards", label: "Cards" },
  { id: "map", label: "Map" },
];

export const tabForStep = (step: number): WorkspaceTab => {
  if (step === 2) return "gaps";
  if (step === 3) return "cards";
  if (step === 4) return "map";
  return "notes";
};

export const audiences = [
  {
    title: "The night-before explainer",
    copy: "You know the lecture, but the “why?” question still exposes the gap.",
    icon: ClipboardCheck,
  },
  {
    title: "The mechanism memoriser",
    copy: "You can name the pathway, but not defend each causal step.",
    icon: Microscope,
  },
  {
    title: "The example follower",
    copy: "You can follow worked solutions, but struggle when the pattern changes.",
    icon: Code2,
  },
  {
    title: "The AI-assisted student",
    copy: "You have summaries everywhere, but still need proof that the understanding is yours.",
    icon: Sparkles,
  },
];

export const landingFeatures = [
  {
    title: "Study Rooms",
    copy: "Keep each exam, paper, or lecture in its own focused workspace.",
    icon: Library,
  },
  {
    title: "Source-grounded feedback",
    copy: "Feynduck checks your explanation against the material you are actually studying.",
    icon: FileText,
  },
  {
    title: "Missing-link detection",
    copy: "See the exact mechanism or reasoning step your explanation skipped.",
    icon: Link2,
  },
  {
    title: "Socratic follow-ups",
    copy: "Get one targeted question that helps you repair the gap yourself.",
    icon: MessageCircleMore,
  },
  {
    title: "Clarity Score",
    copy: "Turn vague confidence into a visible signal you can track.",
    icon: GitBranch,
  },
  {
    title: "Re-explanation loop",
    copy: "Try again with a sharper prompt until the concept actually clicks.",
    icon: Sparkles,
  },
];

export const universities = [
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

export const faqs = [
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
    question: "Is Feynduck just another study material app?",
    answer:
      "No. Most AI study tools summarize material or answer questions for you. Feynduck makes you produce the explanation yourself, so you can test whether you actually understand it.",
  },
  {
    question: "Do I need to add source material to use Feynduck?",
    answer:
      "Yes, for now. Add the material you want Feynduck to use, then explain the concept in your own words. That context helps Feynduck check your explanation against what your class actually covered.",
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

export const pricingTiers = [
  {
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    monthlySuffix: "",
    annualSuffix: "",
    monthlyNote: "One session. No card. See what you actually understand.",
    annualNote: "One session. No card. See what you actually understand.",
    intro: "Try one real Feynduck session",
    cta: "Start studying free",
    items: [
      "One full explanation session with the duck",
      "Add source material such as notes, PDFs, slides, transcripts, or links",
      "The duck finds where your reasoning breaks",
      "See your top 2 gaps with plain-English explanations",
      "One targeted follow-up question to help you fix it",
      "Your first Clarity Score — see where you actually stand",
      "Everything resets after your session. Upgrade to keep going.",
    ],
  },
  {
    name: "Student",
    monthlyPrice: "$12",
    annualPrice: "$96",
    monthlySuffix: "/month",
    annualSuffix: "/year",
    monthlyNote: "or $96/year — that's $8/month",
    annualNote: "Save 33% with annual billing",
    intro: "For students who study regularly",
    cta: "Start Student",
    badge: "✦ Most popular",
    featured: true,
    items: [
      "Unlimited explanation sessions — no daily caps",
      "Up to 10 PDFs per month, 50 pages each",
      "Every gap detected, ranked by how much it matters",
      "Unlimited follow-up questions per session",
      "Flashcards auto-generated from your actual gaps — not generic topic lists",
      "Clarity Score tracked across every session so you can see real progress",
      "Up to 5 active exams organised by subject",
      "Topics extracted automatically when you upload — no manual setup",
    ],
  },
  {
    name: "Scholar",
    monthlyPrice: "$20",
    annualPrice: "$180",
    monthlySuffix: "/month",
    annualSuffix: "/year",
    monthlyNote: "or $180/year — that's $15/month",
    annualNote: "Save 25% with annual billing",
    intro: "For med school, law, and research-heavy degrees",
    cta: "Start Scholar",
    badge: "✦ Best value",
    items: [
      "Everything in Student",
      "Unlimited PDFs, up to 300 pages each — upload full textbooks and case bundles",
      "Mastery Map showing exactly what you understand across every exam and topic",
      "Unlimited active exams — no cap on how many subjects you're studying",
      "Export your gap reports and session notes as a PDF to review offline",
      "Priority processing — faster responses during peak hours",
      "Early access to new features before anyone else",
    ],
  },
  {
    name: "Institution",
    monthlyPrice: "Custom",
    annualPrice: "Custom",
    monthlySuffix: "",
    annualSuffix: "",
    monthlyNote: "For departments, schools, and universities",
    annualNote: "For departments, schools, and universities",
    intro: "Bring Feynduck to a whole cohort",
    cta: "Book a call",
    ctaHref: "mailto:hello@feynduck.ai?subject=Institution%20plan",
    badge: "✦ Teams & campuses",
    items: [
      "Cohort workspaces for classes, modules, and exam groups",
      "Admin controls for seats, subjects, and access",
      "Shared source packs for lectures, reading lists, and revision materials",
      "Aggregate clarity insights without exposing private student explanations",
      "Custom onboarding for tutors, faculty, and learning support teams",
      "Priority support and implementation planning",
    ],
  },
];
