"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Search } from "lucide-react";
import { completeOnboarding, saveOnboardingStep, type OnboardingPayload } from "@src/app/onboarding/actions";
import type { Json } from "@src/types/database";
import type { ProfileRow } from "@src/lib/auth";
import { cn } from "@src/lib/utils";

type StepId = "name" | "stage" | "university" | "year" | "subject" | "goal" | "ready";

type Option = { value: string; label: string; meta?: string };

type UniversitySuggestion = {
  name: string;
  country: string;
};

type Draft = {
  displayName: string;
  educationStage: string;
  institutionName: string;
  institutionCountry: string;
  yearOfStudy: string;
  subjectArea: string;
  studyGoals: string[];
};

const ACADEMIC_STAGES = new Set(["undergraduate", "postgraduate"]);
const CANT_FIND_UNIVERSITY = "I can’t find my university";
const PREFER_NOT_TO_SAY = "Prefer not to say";

const stageOptions: Option[] = [
  { value: "secondary_school", label: "School" },
  { value: "college", label: "College or sixth form" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "professional", label: "Professional qualification" },
  { value: "teacher", label: "Teacher or educator" },
  { value: "other", label: "Other" },
];

const yearOptions: Option[] = ["Foundation year", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5+", "Placement year", "Other"].map(
  (year) => ({ value: year, label: year }),
);

const subjectOptions: Option[] = [
  { value: "medicine_health", label: "Health related" },
  { value: "engineering", label: "Engineering" },
  { value: "computer_science", label: "Computer science" },
  { value: "law", label: "Law" },
  { value: "business_economics", label: "Economics / business" },
  { value: "life_sciences", label: "Biology / life sciences" },
  { value: "maths_physics", label: "Maths / physics" },
  { value: "social_sciences", label: "Psychology / social sciences" },
  { value: "humanities", label: "Humanities" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];

const goalOptions: Option[] = [
  "Exam revision",
  "Understanding lectures and readings",
  "Coursework and essays",
  "Preparing to teach a topic",
  "Learning something for myself",
].map((goal) => ({ value: goal, label: goal }));

function readStringArray(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function labelFor(options: Option[], value: string) {
  return options.find((option) => option.value === value)?.label || value;
}

function getSteps(stage: string): StepId[] {
  // Until a stage is picked, assume the longest (academic) path so the step count doesn't jump down.
  const academic = !stage || ACADEMIC_STAGES.has(stage);
  return ["name", "stage", ...(academic ? (["university", "year"] as StepId[]) : []), "subject", "goal", "ready"];
}

function validate(step: StepId, draft: Draft) {
  if (step === "name" && draft.displayName.trim().length < 2) return "Enter the name Feynduck should use.";
  if (step === "stage" && !draft.educationStage) return "Choose where you are in your learning.";
  if (step === "university" && !draft.institutionName.trim()) return "Choose your university, or one of the options below.";
  if (step === "year" && !draft.yearOfStudy) return "Choose your year.";
  if (step === "subject" && !draft.subjectArea) return "Choose the closest area.";
  return "";
}

function initialDraft(profile: ProfileRow | null, email: string | null): Draft {
  const stage = profile?.education_stage || "";
  const academic = ACADEMIC_STAGES.has(stage);
  return {
    displayName: profile?.display_name || email?.split("@")[0] || "",
    educationStage: stageOptions.some((option) => option.value === stage) ? stage : "",
    institutionName: academic ? profile?.institution_name || "" : "",
    institutionCountry: academic ? profile?.institution_country || "" : "",
    yearOfStudy: academic && yearOptions.some((option) => option.value === profile?.year_of_study) ? profile?.year_of_study || "" : "",
    subjectArea: subjectOptions.some((option) => option.value === profile?.subject_area) ? profile?.subject_area || "" : "",
    studyGoals: readStringArray(profile?.study_goals),
  };
}

function toPayload(draft: Draft, step: number): OnboardingPayload {
  return {
    displayName: draft.displayName,
    educationStage: draft.educationStage,
    educationCountry: draft.institutionCountry,
    institutionName: draft.institutionName,
    institutionCountry: draft.institutionCountry,
    yearOfStudy: draft.yearOfStudy,
    subjectArea: draft.subjectArea,
    studyGoals: draft.studyGoals,
    onboardingStep: step,
  };
}

function CheckMark({ square = false }: { square?: boolean }) {
  return (
    <span className={cn("fd-check", square && "is-square")} aria-hidden="true">
      <Check size={12} strokeWidth={3.2} />
    </span>
  );
}

/** Radio list with roving focus: arrow keys move the selection, Enter selects and continues. */
function RadioOptions({
  label,
  options,
  value,
  onChange,
  onCommit,
  grid = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  grid?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = index === last ? 0 : index + 1;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = index === 0 ? last : index - 1;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = last;

    if (nextIndex !== null) {
      event.preventDefault();
      onChange(options[nextIndex].value);
      refs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onChange(options[index].value);
      onCommit(options[index].value);
    }
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("fd-options", grid && "is-grid")}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selectedIndex < 0 && index === 0) ? 0 : -1}
            className="fd-option"
            data-option
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <CheckMark />
            <span>{option.label}</span>
            {option.meta ? <span className="fd-option-meta">{option.meta}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingFlow({ profile, email }: { profile: ProfileRow | null; email: string | null }) {
  const [draft, setDraft] = useState(() => initialDraft(profile, email));
  const steps = useMemo(() => getSteps(draft.educationStage), [draft.educationStage]);
  const [stepIndex, setStepIndex] = useState(() => {
    const startDraft = initialDraft(profile, email);
    const startSteps = getSteps(startDraft.educationStage);
    const saved = Math.min(Math.max((profile?.onboarding_step || 1) - 1, 0), startSteps.length - 1);
    const firstInvalid = startSteps.findIndex((step) => validate(step, startDraft));
    return firstInvalid >= 0 ? Math.min(saved, firstInvalid) : saved;
  });
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [universityQuery, setUniversityQuery] = useState(() => initialDraft(profile, email).institutionName);
  const [universities, setUniversities] = useState<UniversitySuggestion[]>([]);
  const [universityStatus, setUniversityStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const stepRef = useRef<HTMLDivElement | null>(null);

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isValid = !validate(currentStep, draft);
  const isAcademic = ACADEMIC_STAGES.has(draft.educationStage);

  useEffect(() => {
    if (stepIndex > steps.length - 1) setStepIndex(steps.length - 1);
  }, [stepIndex, steps.length]);

  useEffect(() => {
    const root = stepRef.current;
    if (!root) return;
    const target =
      root.querySelector<HTMLElement>("input") ||
      root.querySelector<HTMLElement>('[data-option][aria-checked="true"]') ||
      root.querySelector<HTMLElement>("[data-option]");
    target?.focus({ preventScroll: true });
  }, [currentStep]);

  useEffect(() => {
    const query = universityQuery.trim();
    if (currentStep !== "university" || query.length < 2 || query === CANT_FIND_UNIVERSITY || query === PREFER_NOT_TO_SAY) {
      setUniversities([]);
      setUniversityStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUniversityStatus("loading");
      try {
        const params = new URLSearchParams({ name: query });
        const response = await fetch(`/api/universities?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error("University search failed");
        const data = (await response.json()) as { universities?: UniversitySuggestion[] };
        setUniversities((data.universities || []).slice(0, 5));
        setUniversityStatus("idle");
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") return;
        setUniversityStatus("error");
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentStep, universityQuery]);

  function updateDraft(updates: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...updates }));
    setError("");
  }

  function selectStage(value: string) {
    const academic = ACADEMIC_STAGES.has(value);
    setDraft((current) => ({
      ...current,
      educationStage: value,
      ...(academic ? {} : { institutionName: "", institutionCountry: "", yearOfStudy: "" }),
    }));
    if (!academic) setUniversityQuery("");
    setError("");
  }

  function goTo(index: number, dir: "forward" | "back") {
    setDirection(dir);
    setStepIndex(index);
    setError("");
  }

  function continueFlow(nextDraft: Draft = draft) {
    const nextSteps = getSteps(nextDraft.educationStage);
    const step = nextSteps[Math.min(stepIndex, nextSteps.length - 1)];
    const validationError = validate(step, nextDraft);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (step === "ready") {
      startTransition(async () => {
        const result = await completeOnboarding(toPayload(nextDraft, nextSteps.length));
        if (!result.ok) setError(result.message);
      });
      return;
    }

    const nextIndex = Math.min(stepIndex + 1, nextSteps.length - 1);
    goTo(nextIndex, "forward");
    void saveOnboardingStep(toPayload(nextDraft, nextIndex + 1)).then((result) => {
      if (!result.ok) setError(result.message);
    });
  }

  function goBack() {
    if (stepIndex === 0) return;
    goTo(stepIndex - 1, "back");
  }

  function handleInputEnter(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      continueFlow();
    }
  }

  const summary: Array<{ label: string; value: string; step: StepId }> = [
    { label: "Name", value: draft.displayName.trim(), step: "name" },
    { label: "Stage", value: labelFor(stageOptions, draft.educationStage), step: "stage" },
    ...(isAcademic
      ? [
          { label: "University", value: draft.institutionName, step: "university" as StepId },
          { label: "Year", value: draft.yearOfStudy, step: "year" as StepId },
        ]
      : []),
    { label: "Subject", value: labelFor(subjectOptions, draft.subjectArea), step: "subject" },
    { label: "Using it for", value: draft.studyGoals.join(", "), step: "goal" },
  ];

  const firstName = draft.displayName.trim().split(/\s+/)[0] || "there";
  const universityOptions: Option[] = universities.map((university) => ({
    value: university.name,
    label: university.name,
    meta: university.country,
  }));

  function renderStep() {
    if (currentStep === "name") {
      return (
        <>
          <div className="fd-ob-question">
            <h1>What should Feynduck call you?</h1>
            <p>This is how you’ll be greeted in your study rooms.</p>
          </div>
          <div className="fd-field">
            <label htmlFor="ob-name" className="fd-label">Your name</label>
            <input
              id="ob-name"
              className="fd-input fd-input-lg"
              value={draft.displayName}
              onChange={(event) => updateDraft({ displayName: event.target.value })}
              onKeyDown={handleInputEnter}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
        </>
      );
    }

    if (currentStep === "stage") {
      return (
        <>
          <div className="fd-ob-question">
            <h1>Where are you in your learning?</h1>
            <p>Feynduck pitches its questions to your level.</p>
          </div>
          <RadioOptions
            label="Learning stage"
            options={stageOptions}
            value={draft.educationStage}
            onChange={selectStage}
            onCommit={(value) => continueFlow({ ...draft, educationStage: value })}
          />
        </>
      );
    }

    if (currentStep === "university") {
      const extraChoices = [CANT_FIND_UNIVERSITY, PREFER_NOT_TO_SAY];
      return (
        <>
          <div className="fd-ob-question">
            <h1>Which university do you study at?</h1>
          </div>
          <div className="fd-field">
            <label htmlFor="ob-uni" className="fd-label">Search universities</label>
            <div className="fd-search">
              <Search size={18} strokeWidth={1.8} aria-hidden="true" />
              <input
                id="ob-uni"
                type="search"
                className="fd-input fd-input-lg"
                value={universityQuery}
                onChange={(event) => {
                  setUniversityQuery(event.target.value);
                  updateDraft({ institutionName: "", institutionCountry: "" });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !draft.institutionName && universities[0]) {
                    event.preventDefault();
                    const top = universities[0];
                    updateDraft({ institutionName: top.name, institutionCountry: top.country });
                    setUniversityQuery(top.name);
                    return;
                  }
                  handleInputEnter(event);
                }}
                placeholder="Start typing your university"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="fd-options">
            {universityStatus === "loading" ? (
              <div className="fd-busy" style={{ padding: "4px 2px" }}>
                <span className="fd-spinner" aria-hidden="true" />
                Searching universities…
              </div>
            ) : null}
            {universityStatus === "error" ? (
              <p className="fd-hint-text">Search isn’t available right now. Pick an option below and carry on.</p>
            ) : null}
            {universityOptions.length ? (
              <RadioOptions
                label="University"
                options={universityOptions}
                value={draft.institutionName}
                onChange={(value) => {
                  const match = universities.find((university) => university.name === value);
                  updateDraft({ institutionName: value, institutionCountry: match?.country || "" });
                }}
                onCommit={(value) => {
                  const match = universities.find((university) => university.name === value);
                  continueFlow({ ...draft, institutionName: value, institutionCountry: match?.country || "" });
                }}
              />
            ) : null}
            <div className="fd-chip-row">
              {extraChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="fd-chip-btn"
                  aria-pressed={draft.institutionName === choice}
                  onClick={() => updateDraft({ institutionName: choice, institutionCountry: "" })}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    if (currentStep === "year") {
      return (
        <>
          <div className="fd-ob-question">
            <h1>What year are you in?</h1>
          </div>
          <RadioOptions
            label="Year"
            options={yearOptions}
            value={draft.yearOfStudy}
            onChange={(value) => updateDraft({ yearOfStudy: value })}
            onCommit={(value) => continueFlow({ ...draft, yearOfStudy: value })}
            grid
          />
        </>
      );
    }

    if (currentStep === "subject") {
      return (
        <>
          <div className="fd-ob-question">
            <h1>What are you studying?</h1>
            <p>Pick the closest area.</p>
          </div>
          <RadioOptions
            label="Subject area"
            options={subjectOptions}
            value={draft.subjectArea}
            onChange={(value) => updateDraft({ subjectArea: value })}
            onCommit={(value) => continueFlow({ ...draft, subjectArea: value })}
            grid
          />
        </>
      );
    }

    if (currentStep === "goal") {
      return (
        <>
          <div className="fd-ob-question">
            <h1>What brings you to Feynduck?</h1>
            <p>Pick any that apply.</p>
          </div>
          <div role="group" aria-label="Goals" className="fd-options">
            {goalOptions.map((option) => {
              const checked = draft.studyGoals.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className="fd-option"
                  data-option
                  onClick={() =>
                    updateDraft({
                      studyGoals: checked
                        ? draft.studyGoals.filter((goal) => goal !== option.value)
                        : [...draft.studyGoals, option.value],
                    })
                  }
                >
                  <CheckMark square />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="fd-ob-question">
          <h1>You’re all set, {firstName}</h1>
          <p>Check your details, then set up your first study room.</p>
        </div>
        <dl className="fd-summary">
          {summary.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value || "—"}</dd>
              <button
                type="button"
                className="fd-btn fd-btn-ghost fd-btn-sm"
                aria-label={`Edit ${row.label.toLowerCase()}`}
                onClick={() => goTo(steps.indexOf(row.step), "back")}
              >
                Edit
              </button>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className="fd-btn fd-btn-accent fd-btn-xl"
          style={{ alignSelf: "flex-start" }}
          onClick={() => continueFlow()}
          disabled={isPending}
          data-option
        >
          {isPending ? <span className="fd-spinner" aria-hidden="true" /> : null}
          {isPending ? "Setting things up…" : "Set up my first room"}
          {isPending ? null : <ArrowRight size={16} className="fd-arrow" />}
        </button>
      </>
    );
  }

  return (
    <div className="fd fd-ob">
      <header className="fd-ob-header">
        <div>
          {stepIndex > 0 ? (
            <button type="button" className="fd-btn fd-btn-ghost fd-ob-back" onClick={goBack} disabled={isPending}>
              <ArrowLeft size={18} strokeWidth={1.8} />
              Back
            </button>
          ) : null}
        </div>
        <div>
          <span className="fd-brand" style={{ cursor: "default" }}>
            <img src="/feynduckhead.png" alt="" width={30} height={30} />
            <span>Feynduck</span>
          </span>
        </div>
        <div>
          <span className="fd-kicker">Step {stepIndex + 1} of {steps.length}</span>
        </div>
      </header>

      <div className="fd-ob-segments" aria-hidden="true">
        {steps.map((step, index) => (
          <span key={step} className={index <= stepIndex ? "is-done" : undefined} />
        ))}
      </div>

      <main className="fd-ob-main">
        <div className="fd-ob-body">
          <div
            key={currentStep}
            ref={stepRef}
            className={cn("fd-ob-step", direction === "back" && "is-back")}
          >
            {renderStep()}
          </div>

          {error ? (
            <div className="fd-notice is-error" role="alert">
              <AlertCircle size={16} strokeWidth={1.8} />
              <span>{error}</span>
            </div>
          ) : null}

          {currentStep !== "ready" ? (
            <div className="fd-ob-footer">
              <span className="fd-hint fd-ob-hint">Press Enter ↵</span>
              <div>
                {currentStep === "goal" ? (
                  <button type="button" className="fd-btn fd-btn-ghost fd-btn-xl" onClick={() => continueFlow()}>
                    Skip
                  </button>
                ) : null}
                <button
                  type="button"
                  className="fd-btn fd-btn-accent fd-btn-xl"
                  aria-disabled={!isValid}
                  onClick={() => continueFlow()}
                >
                  Continue
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
