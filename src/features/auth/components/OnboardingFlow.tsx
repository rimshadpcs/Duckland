"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import { completeOnboarding, saveOnboardingStep, type OnboardingPayload } from "@src/app/onboarding/actions";
import type { Json } from "@src/types/database";
import type { ProfileRow } from "@src/lib/auth";

type StepId = "name" | "stage" | "country" | "year" | "subjects" | "institution" | "programme" | "course" | "context" | "finish";

type Option = {
  value: string;
  label: string;
};

type UniversitySuggestion = {
  name: string;
  country: string;
  website?: string | null;
};

type Draft = {
  displayName: string;
  educationStage: string;
  educationCountry: string;
  yearOfStudy: string;
  qualificationType: string;
  subjectArea: string;
  subjects: string[];
  courseName: string;
  institutionName: string;
  institutionCountry: string;
};

const stageOptions: Option[] = [
  { value: "secondary_school", label: "School" },
  { value: "college", label: "College or sixth form" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "professional", label: "Professional qualification" },
  { value: "teacher", label: "Teacher or educator" },
  { value: "other", label: "Other" },
];

const countryOptions = [
  "United Kingdom",
  "United States",
  "Canada",
  "India",
  "Pakistan",
  "Bangladesh",
  "United Arab Emirates",
  "Saudi Arabia",
  "Australia",
  "Ireland",
  "Germany",
  "France",
  "Malaysia",
  "Singapore",
  "South Africa",
  "Nigeria",
  "Other",
];

const schoolYears = [
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
  "Year 13",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Other",
];

const schoolSubjects = [
  "English",
  "Mathematics",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "History",
  "Geography",
  "Computing",
  "Languages",
  "Design and technology",
  "Art",
  "Music",
  "Physical education",
  "Religious education",
  "Other",
];

const collegeYears = ["First year", "Second year", "Third year or later", "Other"];
const collegeQualifications = ["A levels", "BTEC", "T Level", "Access course", "Apprenticeship", "Other"];
const collegeSubjects = ["Biology", "Chemistry", "Mathematics", "Health and Social Care", "Computer Science", "Other"];
const undergraduateYears = ["Foundation year", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5+", "Placement year", "Other"];
const postgraduateProgrammes = ["Master's", "PhD or doctorate", "Postgraduate diploma or certificate", "Other"];
const professionalStages = ["Just started", "Early stage", "Midway", "Final stage", "Other"];
const universityAreas: Option[] = [
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
const healthSubAreas = ["Medicine", "Pre-med", "Dental", "Nursing", "Veterinary", "Pharmacy", "Other"];

function readSubjects(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function initialDraft(profile: ProfileRow | null, email: string | null): Draft {
  return {
    displayName: profile?.display_name || email?.split("@")[0] || "",
    educationStage: profile?.education_stage || "",
    educationCountry: profile?.education_country || "",
    yearOfStudy: profile?.year_of_study || "",
    qualificationType: profile?.qualification_type || "",
    subjectArea: profile?.subject_area || "",
    subjects: readSubjects(profile?.subjects),
    courseName: profile?.course_name || "",
    institutionName: profile?.institution_name || "",
    institutionCountry: profile?.institution_country || "",
  };
}

function getSteps(stage: string): StepId[] {
  if (stage === "secondary_school") return ["name", "stage", "country", "year", "subjects", "finish"];
  if (stage === "college") return ["name", "stage", "country", "year", "subjects", "finish"];
  if (stage === "undergraduate") return ["name", "stage", "institution", "year", "course", "finish"];
  if (stage === "postgraduate") return ["name", "stage", "institution", "programme", "course", "finish"];
  if (stage === "professional") return ["name", "stage", "course", "year", "finish"];
  if (stage === "teacher") return ["name", "stage", "country", "subjects", "finish"];
  if (stage === "other") return ["name", "stage", "context", "finish"];
  return ["name", "stage"];
}

function stageLabel(value: string) {
  return stageOptions.find((option) => option.value === value)?.label || value;
}

function toPayload(draft: Draft, step: number): OnboardingPayload {
  return {
    displayName: draft.displayName,
    educationStage: draft.educationStage,
    educationCountry: draft.educationCountry || draft.institutionCountry,
    yearOfStudy: draft.yearOfStudy,
    qualificationType: draft.qualificationType,
    subjects: draft.subjects,
    subjectArea: draft.subjectArea,
    courseName: draft.courseName,
    institutionName: draft.institutionName,
    institutionCountry: draft.institutionCountry,
    onboardingStep: step,
  };
}

export function OnboardingFlow({ profile, email }: { profile: ProfileRow | null; email: string | null }) {
  const [draft, setDraft] = useState(() => initialDraft(profile, email));
  const steps = useMemo(() => getSteps(draft.educationStage), [draft.educationStage]);
  const initialStep = Math.min(Math.max((profile?.onboarding_step || 1) - 1, 0), Math.max(steps.length - 1, 0));
  const [stepIndex, setStepIndex] = useState(initialStep);
  const [countryQuery, setCountryQuery] = useState(draft.educationCountry);
  const [universityQuery, setUniversityQuery] = useState(draft.institutionName);
  const [universities, setUniversities] = useState<UniversitySuggestion[]>([]);
  const [universityStatus, setUniversityStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const currentStep = steps[stepIndex] || "finish";
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  useEffect(() => {
    if (currentStep === "name") nameRef.current?.focus();
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== "institution" || universityQuery.trim().length < 2) {
      setUniversities([]);
      setUniversityStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setUniversityStatus("loading");
      try {
        const params = new URLSearchParams({ name: universityQuery.trim() });
        const response = await fetch(`/api/universities?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error("University search failed");
        const data = (await response.json()) as { universities?: UniversitySuggestion[] };
        setUniversities(data.universities || []);
        setUniversityStatus("idle");
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") return;
        setUniversityStatus("error");
      }
    }, 350);

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
    updateDraft({
      educationStage: value,
      educationCountry: "",
      yearOfStudy: "",
      qualificationType: "",
      subjectArea: "",
      subjects: [],
      courseName: "",
      institutionName: "",
      institutionCountry: "",
    });
    setCountryQuery("");
    setUniversityQuery("");
    setStepIndex(1);
  }

  function toggleSubject(subject: string) {
    setDraft((current) => {
      const exists = current.subjects.includes(subject);
      return {
        ...current,
        subjects: exists ? current.subjects.filter((item) => item !== subject) : [...current.subjects, subject],
      };
    });
    setError("");
  }

  function validateStep() {
    if (currentStep === "name" && draft.displayName.trim().length < 2) return "Enter the name Feynduck should use.";
    if (currentStep === "stage" && !draft.educationStage) return "Choose where you are in your learning.";
    if (currentStep === "country" && !draft.educationCountry.trim()) return "Choose or enter your country.";
    if (currentStep === "year" && !draft.yearOfStudy.trim()) return "Choose your current stage.";
    if (currentStep === "subjects" && !draft.subjects.length && !draft.courseName.trim()) return "Choose at least one subject or type your own.";
    if (currentStep === "institution" && !draft.institutionName.trim()) return "Choose your university or use one of the fallback options.";
    if (currentStep === "programme" && !draft.qualificationType.trim()) return "Choose your programme type.";
    if (
      currentStep === "course" &&
      (draft.educationStage === "undergraduate" || draft.educationStage === "postgraduate") &&
      !draft.subjectArea.trim() &&
      !draft.courseName.trim()
    ) {
      return "Choose an area or type what you are studying.";
    }
    if (
      currentStep === "course" &&
      draft.subjectArea === "medicine_health" &&
      !draft.courseName.trim()
    ) {
      return "Choose a health path or type your own.";
    }
    if (currentStep === "course" && draft.educationStage === "professional" && !draft.courseName.trim()) {
      return "Enter what you are studying.";
    }
    if (currentStep === "context" && !draft.courseName.trim()) return "Tell us a little about your learning context.";
    return "";
  }

  function continueFlow() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (currentStep === "finish") {
      startTransition(async () => {
        const result = await completeOnboarding(toPayload(draft, steps.length));
        if (!result.ok) setError(result.message);
      });
      return;
    }

    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    startTransition(async () => {
      const result = await saveOnboardingStep(toPayload(draft, nextIndex + 1));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStepIndex(nextIndex);
    });
  }

  function handleEnter(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      continueFlow();
    }
  }

  function goBack() {
    setStepIndex((current) => Math.max(current - 1, 0));
    setError("");
  }

  function renderPills(options: string[], selected: string, onSelect: (value: string) => void) {
    return (
      <div className="onboarding-pill-grid">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={selected === option ? "onboarding-pill selected" : "onboarding-pill"}
            aria-pressed={selected === option}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  function renderStep() {
    if (currentStep === "name") {
      return (
        <label className="onboarding-field">
          <span>What should Feynduck call you?</span>
          <input
            ref={nameRef}
            value={draft.displayName}
            onChange={(event) => updateDraft({ displayName: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="Your name"
            autoComplete="name"
          />
        </label>
      );
    }

    if (currentStep === "stage") {
      return (
        <div className="onboarding-compact-options">
          {stageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={draft.educationStage === option.value ? "onboarding-compact-card selected" : "onboarding-compact-card"}
              aria-pressed={draft.educationStage === option.value}
              onClick={() => selectStage(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }

    if (currentStep === "country") {
      const visibleCountries = countryOptions.filter((country) =>
        country.toLowerCase().includes(countryQuery.toLowerCase()),
      );
      return (
        <div className="onboarding-field">
          <label htmlFor="country-search">Where are you studying?</label>
          <div className="onboarding-search">
            <Search size={17} />
            <input
              id="country-search"
              value={countryQuery}
              onChange={(event) => {
                setCountryQuery(event.target.value);
                updateDraft({ educationCountry: event.target.value });
              }}
              onKeyDown={handleEnter}
              placeholder="Search country"
            />
          </div>
          <div className="onboarding-chip-row">
            {visibleCountries.slice(0, 9).map((country) => (
              <button
                key={country}
                type="button"
                className={draft.educationCountry === country ? "onboarding-chip selected" : "onboarding-chip"}
                onClick={() => {
                  setCountryQuery(country);
                  updateDraft({ educationCountry: country });
                }}
              >
                {country}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (currentStep === "year") {
      if (draft.educationStage === "secondary_school") {
        return (
          <label className="onboarding-field">
            <span>What year or grade are you in?</span>
            <select value={draft.yearOfStudy} onChange={(event) => updateDraft({ yearOfStudy: event.target.value })}>
              <option value="">Choose year or grade</option>
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        );
      }

      if (draft.educationStage === "college") {
        return (
          <div className="onboarding-stack compact">
            {renderPills(collegeYears, draft.yearOfStudy, (value) => updateDraft({ yearOfStudy: value }))}
            <label className="onboarding-field compact">
              <span>Qualification</span>
              <select value={draft.qualificationType} onChange={(event) => updateDraft({ qualificationType: event.target.value })}>
                <option value="">Choose qualification</option>
                {collegeQualifications.map((qualification) => (
                  <option key={qualification} value={qualification}>
                    {qualification}
                  </option>
                ))}
              </select>
            </label>
          </div>
        );
      }

      if (draft.educationStage === "professional") {
        return renderPills(professionalStages, draft.yearOfStudy, (value) => updateDraft({ yearOfStudy: value }));
      }

      return renderPills(undergraduateYears, draft.yearOfStudy, (value) => updateDraft({ yearOfStudy: value }));
    }

    if (currentStep === "subjects") {
      const options = draft.educationStage === "college" ? collegeSubjects : schoolSubjects;
      return (
        <div className="onboarding-field">
          <span>{draft.educationStage === "teacher" ? "What subjects do you teach?" : "What subjects are you studying?"}</span>
          <div className="onboarding-subject-grid">
            {options.map((subject) => (
              <button
                key={subject}
                type="button"
                className={draft.subjects.includes(subject) ? "onboarding-subject selected" : "onboarding-subject"}
                aria-pressed={draft.subjects.includes(subject)}
                onClick={() => toggleSubject(subject)}
              >
                {subject}
              </button>
            ))}
          </div>
          <input
            value={draft.courseName}
            onChange={(event) => updateDraft({ courseName: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="Or type another subject or course"
          />
        </div>
      );
    }

    if (currentStep === "institution") {
      return (
        <div className="onboarding-field">
          <label htmlFor="university-search">Which university do you study at?</label>
          <div className="onboarding-search">
            <Search size={17} />
            <input
              id="university-search"
              value={universityQuery}
              onChange={(event) => {
                setUniversityQuery(event.target.value);
                updateDraft({ institutionName: event.target.value, institutionCountry: "" });
              }}
              onKeyDown={handleEnter}
              placeholder="Search university"
            />
          </div>
          <div className="onboarding-results compact" role="listbox">
            {universityStatus === "loading" ? (
              <div className="onboarding-result muted">
                <Loader2 className="icon-spin" size={16} />
                Searching universities...
              </div>
            ) : null}
            {universityStatus === "error" ? (
              <div className="onboarding-result muted">Search is unavailable. You can type it manually.</div>
            ) : null}
            {universities.map((university) => (
              <button
                key={`${university.name}-${university.country}`}
                type="button"
                className="onboarding-result"
                onClick={() => {
                  setUniversityQuery(university.name);
                  updateDraft({
                    institutionName: university.name,
                    institutionCountry: university.country,
                    educationCountry: university.country,
                  });
                }}
              >
                <span>{university.name}</span>
                <small>{university.country}</small>
              </button>
            ))}
            <button
              type="button"
              className="onboarding-result"
              onClick={() => updateDraft({ institutionName: universityQuery || "I can't find my university", institutionCountry: "" })}
            >
              I can't find my university
            </button>
            <button
              type="button"
              className="onboarding-result"
              onClick={() => {
                setUniversityQuery("Prefer not to say");
                updateDraft({ institutionName: "Prefer not to say", institutionCountry: "" });
              }}
            >
              Prefer not to say
            </button>
          </div>
        </div>
      );
    }

    if (currentStep === "programme") {
      return renderPills(postgraduateProgrammes, draft.qualificationType, (value) => updateDraft({ qualificationType: value }));
    }

    if (currentStep === "course") {
      if (draft.educationStage === "undergraduate" || draft.educationStage === "postgraduate") {
        return (
          <div className="onboarding-field">
            <span>What area are you studying?</span>
            <div className="onboarding-subject-grid university">
              {universityAreas.map((area) => (
                <button
                  key={area.value}
                  type="button"
                  className={draft.subjectArea === area.value ? "onboarding-subject selected" : "onboarding-subject"}
                  aria-pressed={draft.subjectArea === area.value}
                  onClick={() =>
                    updateDraft({
                      subjectArea: area.value,
                      courseName: area.value === "medicine_health" || area.value === "other" ? "" : area.label,
                    })
                  }
                >
                  {area.label}
                </button>
              ))}
            </div>

            {draft.subjectArea === "medicine_health" ? (
              <div className="onboarding-nested-options">
                <span>Which health path?</span>
                <div className="onboarding-pill-grid">
                  {healthSubAreas.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={draft.courseName === path ? "onboarding-pill selected" : "onboarding-pill"}
                      aria-pressed={draft.courseName === path}
                      onClick={() => updateDraft({ courseName: path === "Other" ? "" : path })}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.subjectArea === "other" || draft.subjectArea === "medicine_health" ? (
              <input
                value={draft.courseName}
                onChange={(event) => updateDraft({ courseName: event.target.value })}
                onKeyDown={handleEnter}
                placeholder={draft.subjectArea === "medicine_health" ? "Other health path" : "Type your course or subject"}
              />
            ) : null}
          </div>
        );
      }

      return (
        <label className="onboarding-field">
          <span>{draft.educationStage === "professional" ? "What qualification are you studying?" : "What are you studying?"}</span>
          <input
            value={draft.courseName}
            onChange={(event) => updateDraft({ courseName: event.target.value })}
            onKeyDown={handleEnter}
            placeholder={
              draft.educationStage === "professional"
                ? "ACCA, bar exam, nursing board exam..."
                : "Medicine, Computer Science, Mechanical Engineering, Economics"
            }
          />
        </label>
      );
    }

    if (currentStep === "context") {
      return (
        <label className="onboarding-field">
          <span>Tell us a little about your learning context.</span>
          <textarea
            value={draft.courseName}
            onChange={(event) => updateDraft({ courseName: event.target.value })}
            onKeyDown={handleEnter}
            placeholder="I am self-studying biology for an entrance exam..."
          />
        </label>
      );
    }

    return (
      <div className="onboarding-ready compact">
        <h2>You&apos;re ready to study</h2>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{draft.displayName}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{stageLabel(draft.educationStage)}</dd>
          </div>
          <div>
            <dt>{draft.institutionName ? "Course" : "Subjects"}</dt>
            <dd>{draft.courseName || draft.subjects.join(", ")}</dd>
          </div>
          {draft.institutionName ? (
            <div>
              <dt>University</dt>
              <dd>{draft.institutionName}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  const questionByStep: Record<StepId, string> = {
    name: "What should Feynduck call you?",
    stage: "Where are you in your learning?",
    country: "Where are you studying?",
    year:
      draft.educationStage === "secondary_school"
        ? "What year or grade are you in?"
        : draft.educationStage === "undergraduate"
          ? "What year are you in?"
          : "What stage are you at?",
    subjects: draft.educationStage === "teacher" ? "What subjects do you teach?" : "What subjects are you studying?",
    institution: "Which university do you study at?",
    programme: "What type of programme is it?",
    course: draft.educationStage === "professional" ? "What qualification are you studying?" : "What are you studying?",
    context: "Tell us a little about your learning context.",
    finish: "You’re ready to study",
  };

  return (
    <main className="onboarding-page">
      <button type="button" className="onboarding-back floating" onClick={goBack} disabled={stepIndex === 0 || isPending}>
        <ArrowLeft size={17} />
        Back
      </button>

      <a className="auth-brand onboarding-logo" href="/" aria-label="Feynduck home">
        <img src="/feynduckhead.png" alt="" />
        <span>Feynduck</span>
      </a>

      <section className="onboarding-stage">
        <div className="onboarding-step-count">Step {stepIndex + 1} of {steps.length}</div>
        <div className="onboarding-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="onboarding-compact-heading">
          <p>Feynduck setup</p>
          <h1>{questionByStep[currentStep]}</h1>
        </div>
        <div className="onboarding-body compact">{renderStep()}</div>
        {error ? (
          <p className="onboarding-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="onboarding-actions">
          <button type="button" className="onboarding-continue" onClick={continueFlow} disabled={isPending}>
            {isPending ? <Loader2 className="icon-spin" size={18} /> : <Check size={18} />}
            {currentStep === "finish" ? "Start studying" : "Continue"}
          </button>
        </div>
      </section>
    </main>
  );
}
