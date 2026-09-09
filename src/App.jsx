import React, { useState, useEffect, useRef } from "react";
import {
  Heart,
  CalendarClock,
  Thermometer,
  UtensilsCrossed,
  Users,
  FileText,
  ClipboardList,
  Stethoscope,
  Briefcase,
  AlertCircle,
  Clock,
  Mail,
  Send,
  Check,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  ShieldCheck,
  Image,
  Upload,
  LogOut,
} from "lucide-react";
import { supabase, supabaseConfigError } from "./lib/supabase";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const browserTemplateStorage = {
  dbPromise: null,
  open() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open("friendly-forms", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("templates");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  },
  async get(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction("templates", "readonly").objectStore("templates").get(key);
      request.onsuccess = () => resolve({ value: request.result || null });
      request.onerror = () => reject(request.error);
    });
  },
  async set(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction("templates", "readwrite").objectStore("templates").put(value, key);
      request.onsuccess = () => resolve({ key, value });
      request.onerror = () => reject(request.error);
    });
  },
};

const appStorage = {
  async get(key, shared = false) {
    if (key.startsWith("form-template:")) return browserTemplateStorage.get(key);
    if (window.storage) return window.storage.get(key, shared);
    return { value: window.localStorage.getItem(key) };
  },
  async set(key, value, shared = false) {
    if (key.startsWith("form-template:")) return browserTemplateStorage.set(key, value);
    if (window.storage) return window.storage.set(key, value, shared);
    window.localStorage.setItem(key, value);
    return { key, value };
  },
  async list(prefix) {
    if (window.storage) return window.storage.list(prefix, false);
    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(prefix));
    return { keys };
  },
};

// ---------- design tokens ----------
const COLORS = {
  ink: "#1E2B33",
  paper: "#FAF9F6",
  card: "#FFFFFF",
  heart: "#5FA8C9",
  heartDeep: "#2E6E8E",
  sand: "#EFE9DE",
  line: "#E3DED3",
  good: "#4C8F6B",
  warn: "#B8763F",
  bad: "#B0503F",
};

const ICONS = {
  CalendarClock,
  Thermometer,
  UtensilsCrossed,
  Users,
  FileText,
  ClipboardList,
  Stethoscope,
  Briefcase,
  AlertCircle,
  Heart,
  Image,
};
const ICON_OPTIONS = Object.keys(ICONS);

const FIELD_TYPE_LABELS = {
  text: "Short text",
  email: "Email",
  tel: "Phone",
  number: "Number",
  date: "Date",
  time: "Time",
  textarea: "Long text",
  chips: "Choice (pick one)",
  "chips-multi": "Choice (pick any)",
  checkbox: "Checkbox / agreement",
  signature: "Signature",
  file: "Photo upload",
  notice: "Info text (read-only)",
  repeater: "Repeating group of fields",
};

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "form";

const uid = () => Math.random().toString(36).slice(2, 9);

const REASONS = [
  "Sick Leave",
  "Funeral/Family Loss",
  "Medical Leave",
  "Vacation",
  "Maternity",
  "Personal",
  "Jury Duty",
  "Other",
];

// ---------- default form definitions (seeded once, then admin-editable) ----------
const DEFAULT_SCHEMAS = [
  {
    id: "timeoff",
    label: "Time Off",
    icon: "CalendarClock",
    badge: "PTO",
    ready: true,
    fields: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "email", type: "email", label: "Email" },
      { id: "phone", type: "tel", label: "Phone" },
      { id: "reason", type: "chips", label: "Reason for Request", required: true, options: REASONS },
      { id: "reasonOther", type: "text", label: "Specify other reason", showIf: { field: "reason", equals: "Other" } },
      { id: "beginningOn", type: "date", label: "Beginning On", required: true },
      { id: "numberOfHours", type: "number", label: "Number of Hours" },
      { id: "endingOn", type: "date", label: "Ending On" },
      { id: "returnToWork", type: "date", label: "Return to Work" },
      { id: "informed", type: "chips", label: "Did I inform the client's families AND my supervisor?", options: ["Yes", "No"] },
      { id: "supervisorDate", type: "date", label: "Supervisor informed — date" },
      { id: "supervisorName", type: "text", label: "Supervisor name" },
      { id: "clientInfo", type: "text", label: "Client family informed (date / initials)" },
      { id: "agree", type: "checkbox", label: "I have read the terms and conditions and agree to them; if I have questions or concerns, I will reach out to the Friendly Forms admin team for clarification." },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "sicktime",
    label: "Sick Time",
    icon: "Thermometer",
    badge: "Sick Time",
    ready: true,
    fields: [
      { id: "name", type: "text", label: "Name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "email", type: "email", label: "Email" },
      { id: "phone", type: "tel", label: "Phone" },
      { id: "reason", type: "chips", label: "Reason for Request", required: true, options: REASONS },
      { id: "reasonOther", type: "text", label: "Specify other reason", showIf: { field: "reason", equals: "Other" } },
      { id: "beginningOn", type: "date", label: "Beginning On", required: true },
      { id: "numberOfHours", type: "number", label: "Number of Hours" },
      { id: "endingOn", type: "date", label: "Ending On" },
      { id: "returnToWork", type: "date", label: "Return to Work" },
      { id: "informed", type: "chips", label: "Did I inform the client's families AND my supervisor?", options: ["Yes", "No"] },
      { id: "supervisorDate", type: "date", label: "Supervisor informed — date" },
      { id: "supervisorName", type: "text", label: "Supervisor name" },
      { id: "clientInfo", type: "text", label: "Client family informed (date / initials)" },
      { id: "agree", type: "checkbox", label: "I have read the terms and conditions and agree to them; if I have questions or concerns, I will reach out to the Friendly Forms admin team for clarification." },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "mealwaiver",
    label: "Meal Waiver",
    icon: "UtensilsCrossed",
    ready: true,
    fields: [
      { id: "name", type: "text", label: "Employee Name", required: true },
      { id: "dates", type: "text", label: "Date(s)", required: true, placeholder: "e.g. 8/23/2026" },
      { id: "workLocation", type: "text", label: "Work Location" },
      {
        id: "acknowledgment",
        type: "notice",
        label: "By signing, I acknowledge:",
        listType: "ol",
        content: [
          "I was offered and provided the opportunity to take a 30-minute unpaid, duty-free meal break on the date(s) above.",
          "I voluntarily chose not to take my meal break and continued working during this time.",
          "I understand that because I worked through my meal break, I will be paid for this time in accordance with Colorado law.",
          "I understand that this does not waive my right to future meal breaks as required by law.",
          "I agree to notify my supervisor if I am not provided the opportunity to take a legally required break in the future.",
        ],
      },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "meal",
    label: "Meal Form",
    icon: "FileText",
    ready: true,
    fields: [
      { id: "staffName", type: "text", label: "Staff", required: true },
      { id: "role", type: "text", label: "Role", defaultValue: "Behavior Technician" },
      {
        id: "log",
        type: "repeater",
        label: "Lunch Break Log",
        addLabel: "Add day",
        required: true,
        fields: [
          { id: "date", type: "date", label: "Date", required: true },
          { id: "clockOut", type: "time", label: "Clock out", required: true },
          { id: "clockIn", type: "time", label: "Clock in", required: true },
        ],
      },
      { id: "signature", type: "signature", label: "Staff Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "cotreatment",
    label: "Co-Treatment",
    icon: "Users",
    ready: true,
    fields: [
      {
        id: "compliance",
        type: "notice",
        label: "",
        content: [
          "Only the minutes the RBT is actively providing 1:1 ABA services may be billed. All overlapping time must be clearly documented, and all co-treatment/observation time must be signed by the parent, guardian, or teacher. Billable time must be adjusted to remain compliant with Colorado Medicaid requirements.",
          "If another provider arrives before you, enter your own arrival time as the Provider Start Time — only time when you and the provider are both present is tracked.",
        ],
      },
      {
        id: "entries",
        type: "repeater",
        label: "Entries",
        addLabel: "Add entry",
        required: true,
        fields: [
          { id: "clientInitials", type: "text", label: "Client Initials", placeholder: "e.g. J.S." },
          { id: "date", type: "date", label: "Date", required: true },
          { id: "therapyType", type: "chips", label: "Therapy Type", required: true, options: ["OT", "ST", "PT", "Other"] },
          { id: "therapyTypeOther", type: "text", label: "Specify therapy type", showIf: { field: "therapyType", equals: "Other" } },
          { id: "providerStart", type: "time", label: "Provider Start Time", required: true },
          { id: "providerEnd", type: "time", label: "Provider End Time", required: true },
          { id: "rbtStart", type: "time", label: "RBT Start Time", required: true },
          { id: "rbtEnd", type: "time", label: "RBT End Time", required: true },
          { id: "types", type: "chips-multi", label: "Type — check all that apply", options: ["Break", "Observation", "Co-Treatment"] },
        ],
      },
      {
        id: "notesIntro",
        type: "notice",
        label: "Co-Treatment Notes",
        content: [
          "Does not replace your session note in Rethink — both are required. Describe what occurred during the overlap, behaviors observed, ABA interventions implemented, and medical necessity of services provided.",
        ],
      },
      {
        id: "notes",
        type: "repeater",
        label: "",
        addLabel: "Add note",
        required: true,
        fields: [
          { id: "date", type: "date", label: "Date", required: true },
          { id: "notes", type: "textarea", label: "Notes", required: true },
          { id: "parentSignature", type: "signature", label: "Parent/Guardian Signature (typed name)", required: true },
        ],
      },
      { id: "staffSignature", type: "signature", label: "Staff Signature — type your full legal name", required: true },
      { id: "staffDate", type: "date", label: "Date", required: true },
    ],
  },
  {
    id: "wellness",
    label: "Wellness Reimbursement",
    icon: "Image",
    ready: true,
    fields: [
      {
        id: "eligibility",
        type: "notice",
        label: "",
        content: [
          "Available to full-time employees. Terms and eligibility details are being finalized and will be added here once confirmed against the employee handbook.",
        ],
      },
      { id: "name", type: "text", label: "Employee Name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "fullTimeConfirm", type: "checkbox", label: "I confirm I am a full-time employee." },
      { id: "activity", type: "text", label: "Wellness membership or activity", required: true, placeholder: "e.g. gym membership, yoga class" },
      { id: "amount", type: "number", label: "Reimbursement Amount ($)", required: true },
      { id: "receipt", type: "file", label: "Receipt Photo", required: true },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "mileage",
    label: "Mileage Reimbursement",
    icon: "Image",
    ready: true,
    fields: [
      { id: "name", type: "text", label: "Employee Name", required: true },
      { id: "date", type: "date", label: "Date of Travel", required: true },
      { id: "client", type: "text", label: "Client", required: true },
      { id: "screenshot", type: "file", label: "Google Maps Screenshot", required: true, placeholder: "Tap to add screenshot" },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "insurance",
    label: "Insurance Reimbursement",
    icon: "Image",
    ready: true,
    fields: [
      { id: "name", type: "text", label: "Employee Name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "screenshot", type: "file", label: "Payment Screenshot", required: true, placeholder: "Tap to add screenshot" },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "reinforcer",
    label: "Reinforcer Form",
    icon: "ClipboardList",
    ready: false,
    fields: [
      { id: "name", type: "text", label: "Employee Name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "client", type: "text", label: "Client" },
      { id: "details", type: "textarea", label: "Reinforcer details", required: true },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
  {
    id: "vto",
    label: "VTO Request",
    icon: "Briefcase",
    ready: false,
    fields: [
      { id: "name", type: "text", label: "Employee Name", required: true },
      { id: "date", type: "date", label: "Date", required: true },
      { id: "beginningOn", type: "date", label: "Beginning On", required: true },
      { id: "endingOn", type: "date", label: "Ending On", required: true },
      { id: "reason", type: "textarea", label: "Reason for Request", required: true },
      { id: "signature", type: "signature", label: "Signature — type your full legal name", required: true },
    ],
  },
];

function mergeSchemas(saved) {
  const savedById = new Map(saved.map((schema) => [schema.id, schema]));
  const defaults = DEFAULT_SCHEMAS.map((schema) => savedById.get(schema.id) || schema);
  const defaultIds = new Set(DEFAULT_SCHEMAS.map((schema) => schema.id));
  return [...defaults, ...saved.filter((schema) => !defaultIds.has(schema.id))];
}

// ---------- small UI atoms ----------
function HeartbeatDivider() {
  return (
    <svg viewBox="0 0 400 24" className="w-full h-5" preserveAspectRatio="none">
      <polyline
        points="0,12 140,12 158,4 172,20 188,2 204,22 220,12 400,12"
        fill="none"
        stroke={COLORS.heart}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

function Field({ label, children, span, hint }) {
  return (
    <label className={`flex flex-col gap-1.5 ${span ? "sm:col-span-2" : ""}`}>
      {label && (
        <span
          className="text-[11px] tracking-wide uppercase font-medium"
          style={{ color: COLORS.heartDeep, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {label}
        </span>
      )}
      {children}
      {hint && (
        <span className="text-[12px]" style={{ color: "#8A8378" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border bg-white px-3 py-2 text-[15px] outline-none transition focus:ring-2";

function TextInput(props) {
  return (
    <input
      {...props}
      className={inputCls}
      style={{ borderColor: COLORS.line, fontFamily: "'Source Sans 3', sans-serif", ...(props.style || {}) }}
      onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${COLORS.heart}33`)}
      onBlur={(e) => (e.target.style.boxShadow = "none")}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      rows={props.rows || 3}
      className={`${inputCls} resize-none`}
      style={{ borderColor: COLORS.line, fontFamily: "'Source Sans 3', sans-serif", ...(props.style || {}) }}
      onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${COLORS.heart}33`)}
      onBlur={(e) => (e.target.style.boxShadow = "none")}
    />
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[13.5px] font-medium border transition"
      style={{
        borderColor: selected ? COLORS.heartDeep : COLORS.line,
        background: selected ? COLORS.heartDeep : "white",
        color: selected ? "white" : COLORS.ink,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[13.5px] font-medium"
      style={{ color: COLORS.ink }}
    >
      <span
        className="w-9 h-5 rounded-full relative transition flex-shrink-0"
        style={{ background: checked ? COLORS.heartDeep : COLORS.line }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition"
          style={{ left: checked ? "18px" : "2px" }}
        />
      </span>
      {label}
    </button>
  );
}

// ---------- generic field rendering (RBT-facing forms) ----------
function isVisible(field, values) {
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
}

function fieldFilled(field, value) {
  if (!field.required) return true;
  if (field.type === "checkbox") return !!value;
  if (field.type === "chips-multi") return Array.isArray(value) && value.length > 0;
  if (field.type === "repeater") {
    if (!Array.isArray(value) || value.length === 0) return false;
    return value.every((row) => field.fields.every((sf) => isVisible(sf, row) ? fieldFilled(sf, row[sf.id]) : true));
  }
  return !!value;
}

function allRequiredFilled(fields, values) {
  return fields.every((f) => (isVisible(f, values) ? fieldFilled(f, values[f.id]) : true));
}

function emptyRepeaterRow(subfields) {
  const row = { _id: uid() };
  subfields.forEach((sf) => {
    row[sf.id] = sf.type === "chips-multi" ? [] : sf.defaultValue || "";
  });
  return row;
}

function LeafField({ field, value, onChange }) {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value) };
  switch (field.type) {
    case "text":
      return <TextInput {...common} placeholder={field.placeholder} />;
    case "email":
      return <TextInput type="email" {...common} placeholder={field.placeholder} />;
    case "tel":
      return <TextInput type="tel" {...common} placeholder={field.placeholder} />;
    case "number":
      return <TextInput type="number" {...common} placeholder={field.placeholder} />;
    case "date":
      return <TextInput type="date" {...common} />;
    case "time":
      return <TextInput type="time" {...common} />;
    case "textarea":
      return <TextArea {...common} placeholder={field.placeholder} />;
    case "signature":
      return (
        <TextInput
          {...common}
          placeholder={field.placeholder || "Type your name to sign"}
          style={{ fontFamily: "'Caveat', cursive", fontSize: "22px" }}
        />
      );
    case "chips":
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {(field.options || []).map((o) => (
            <Chip key={o} selected={value === o} onClick={() => onChange(o)}>
              {o}
            </Chip>
          ))}
        </div>
      );
    case "chips-multi":
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {(field.options || []).map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const selected = arr.includes(o);
            return (
              <Chip
                key={o}
                selected={selected}
                onClick={() => onChange(selected ? arr.filter((x) => x !== o) : [...arr, o])}
              >
                {o}
              </Chip>
            );
          })}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <span
            className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center"
            style={{ borderColor: COLORS.heartDeep, background: value ? COLORS.heartDeep : "white" }}
            onClick={() => onChange(!value)}
          >
            {value && <Check size={14} color="white" strokeWidth={3} />}
          </span>
          <span className="text-[14px]" style={{ color: COLORS.ink }}>
            {field.label}
          </span>
        </label>
      );
    case "file":
      return <FileInput field={field} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function FileInput({ field, value, onChange }) {
  const inputRef = useRef(null);

  const handlePick = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      {value && value.dataUrl ? (
        <div className="flex items-center gap-3">
          <img src={value.dataUrl} alt={value.name} className="w-16 h-16 object-cover rounded-md" style={{ border: `1px solid ${COLORS.line}` }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] truncate" style={{ color: COLORS.ink }}>{value.name}</p>
            <button type="button" onClick={() => onChange(null)} className="text-[12.5px] font-medium" style={{ color: COLORS.warn }}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current && inputRef.current.click()}
          className="w-full flex items-center justify-center gap-2 py-6 rounded-md border border-dashed text-[13.5px] font-medium"
          style={{ borderColor: COLORS.line, color: COLORS.heartDeep }}
        >
          <Upload size={16} />
          {field.placeholder || "Tap to add a photo"}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />
    </div>
  );
}

function RepeaterRow({ field, row, index, onUpdate, onRemove, canRemove }) {
  return (
    <div className="rounded-lg p-4" style={{ border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[11px] tracking-wide uppercase font-medium"
          style={{ color: COLORS.heartDeep, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {field.label || "Entry"} {index + 1}
        </span>
        <button type="button" onClick={onRemove} disabled={!canRemove} style={{ color: canRemove ? COLORS.warn : "#CFC9BC" }}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {field.fields.filter((sf) => isVisible(sf, row)).map((sf) => (
          <Field key={sf.id} label={sf.label} span={sf.type === "textarea" || sf.type === "notice"}>
            <LeafField field={sf} value={row[sf.id]} onChange={(v) => onUpdate(sf.id, v)} />
          </Field>
        ))}
      </div>
    </div>
  );
}

function FieldBlock({ field, value, onChange }) {
  if (field.type === "notice") {
    return (
      <div className="rounded-lg p-4 space-y-2" style={{ background: COLORS.sand, border: `1px solid ${COLORS.line}` }}>
        {field.label && (
          <div className="text-[13px] font-semibold" style={{ color: COLORS.heartDeep }}>
            {field.label}
          </div>
        )}
        {field.listType === "ol" ? (
          <ol className="space-y-2 list-decimal list-inside">
            {field.content.map((p, i) => (
              <li key={i} className="text-[14px]" style={{ color: COLORS.ink }}>
                {p}
              </li>
            ))}
          </ol>
        ) : (
          field.content.map((p, i) => (
            <p key={i} className="text-[13px]" style={{ color: COLORS.ink }}>
              {p}
            </p>
          ))
        )}
      </div>
    );
  }

  if (field.type === "repeater") {
    const rows = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-3">
        {field.label && (
          <div
            className="text-[11px] tracking-wide uppercase font-medium"
            style={{ color: COLORS.heartDeep, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {field.label}
          </div>
        )}
        <div className="space-y-4">
          {rows.map((row, i) => (
            <RepeaterRow
              key={row._id}
              field={field}
              row={row}
              index={i}
              canRemove={rows.length > 1}
              onUpdate={(k, v) => {
                const next = rows.map((r) => (r._id === row._id ? { ...r, [k]: v } : r));
                onChange(next);
              }}
              onRemove={() => onChange(rows.length > 1 ? rows.filter((r) => r._id !== row._id) : rows)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, emptyRepeaterRow(field.fields)])}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium px-3 py-1.5 rounded-full border"
          style={{ borderColor: COLORS.line, color: COLORS.heartDeep }}
        >
          <Plus size={14} />
          {field.addLabel || "Add"}
        </button>
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="rounded-lg p-4" style={{ background: COLORS.sand, border: `1px solid ${COLORS.line}` }}>
        <LeafField field={field} value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <Field label={field.label} hint={field.hint}>
      <LeafField field={field} value={value} onChange={onChange} />
    </Field>
  );
}

function buildEmailBody(fields, values, indent = "") {
  const lines = [];
  fields.forEach((f) => {
    if (!isVisible(f, values)) return;
    if (f.type === "notice") return;
    const v = values[f.id];
    if (f.type === "repeater") {
      lines.push(`${indent}${f.label || "Entries"}:`);
      (v || []).forEach((row, i) => {
        lines.push(`${indent}  Entry ${i + 1}`);
        f.fields.forEach((sf) => {
          if (!isVisible(sf, row)) return;
          const sv = sf.type === "chips-multi" ? (row[sf.id] || []).join(", ") : sf.type === "file" ? (row[sf.id] ? `[attach photo: ${row[sf.id].name}]` : "") : row[sf.id] || "";
          lines.push(`${indent}    ${sf.label}: ${sv}`);
        });
      });
    } else if (f.type === "checkbox") {
      lines.push(`${indent}${f.label}: ${v ? "Yes" : "No"}`);
    } else if (f.type === "chips-multi") {
      lines.push(`${indent}${f.label}: ${(v || []).join(", ")}`);
    } else if (f.type === "file") {
      lines.push(`${indent}${f.label}: ${v ? `[attach photo: ${v.name}]` : ""}`);
    } else {
      lines.push(`${indent}${f.label}: ${v || ""}`);
    }
  });
  return lines.join("\n");
}

function hasFileField(fields) {
  return fields.some((f) => f.type === "file" || (f.type === "repeater" && hasFileField(f.fields)));
}

async function generateMealWaiverPdf(values) {
 const response = await fetch("/templates/meal-break-waiver.pdf", { cache: "no-store" });
  if (!response.ok) throw new Error("Meal Break Waiver template could not be loaded.");

  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const signatureFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const color = rgb(0.05, 0.2, 0.45);

  const fields = [
    { x: 182, y: 569.3, value: values.name, size: 11, maxWidth: 160 },
    { x: 136, y: 553.4, value: values.dates, size: 11, maxWidth: 205 },
    { x: 174, y: 537.6, value: values.workLocation, size: 11, maxWidth: 150 },
    { x: 199, y: 237.7, value: values.signature, size: 16, maxWidth: 160, font: signatureFont },
  ];

  fields.forEach(({ x, y, value, size, maxWidth, font: fieldFont = font }) => {
    if (!value) return;
    const text = String(value);
    const fitted = fieldFont.widthOfTextAtSize(text, size) > maxWidth
      ? text.slice(0, Math.floor(text.length * (maxWidth / fieldFont.widthOfTextAtSize(text, size))))
      : text;
    page.drawText(fitted, { x, y, size, font: fieldFont, color });
  });

  return pdf.save();
}

async function generateUploadedTemplatePdf(template, schema, values) {
  const pdf = await PDFDocument.load(template.dataUrl);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const color = rgb(0.05, 0.2, 0.45);
  const form = pdf.getForm();
  const pdfFields = form.getFields();
  const fieldValues = flattenPdfValues(schema.fields, values);
  let filledFields = 0;

  pdfFields.forEach((pdfField) => {
    const name = pdfField.getName();
    const appField = fieldValues.find(({ field }) =>
      [field.pdfFieldName, field.id, field.label].filter(Boolean).some((candidate) => normalizePdfFieldName(candidate) === normalizePdfFieldName(name))
    );
    if (!appField || appField.value === undefined || appField.value === null || appField.value === "") return;

    try {
      const fieldType = pdfField.constructor.name;
      if (fieldType === "PDFCheckBox") {
        if (appField.value) pdfField.check();
      } else if (fieldType === "PDFDropdown" || fieldType === "PDFOptionList" || fieldType === "PDFRadioGroup") {
        pdfField.select(String(Array.isArray(appField.value) ? appField.value[0] : appField.value));
      } else if (typeof pdfField.setText === "function") {
        pdfField.setText(String(appField.value));
      }
      filledFields += 1;
    } catch (error) {
      console.warn(`Could not fill PDF field "${name}"`, error);
    }
  });

  if (filledFields > 0) {
    form.updateFieldAppearances(font);
    return pdf.save();
  }

  const positionedFields = fieldValues.filter(({ field, value }) =>
    field.pdfPlacement && value !== undefined && value !== null && value !== ""
  );
  if (positionedFields.length > 0) {
    positionedFields.forEach(({ field, value }) => {
      const placement = field.pdfPlacement;
      const page = pdf.getPages()[Number(placement.page || 1) - 1];
      if (!page) return;
      const size = Number(placement.fontSize) || 11;
      const maxWidth = Number(placement.width) || 180;
      const text = String(value);
      const fitted = font.widthOfTextAtSize(text, size) > maxWidth
        ? text.slice(0, Math.floor(text.length * (maxWidth / font.widthOfTextAtSize(text, size))))
        : text;
      page.drawText(fitted, {
        x: Number(placement.x) || 0,
        y: Number(placement.y) || 0,
        size,
        font,
        color,
      });
    });
    return pdf.save();
  }

  const pages = pdf.getPages();
  const page = pages[pages.length - 1];
  const lines = buildEmailBody(schema.fields, values).split("\n").filter(Boolean);
  const lineHeight = 14;
  const maxLines = Math.floor((page.getHeight() - 72) / lineHeight);
  const visibleLines = lines.slice(0, maxLines - 1);
  const startY = page.getHeight() - 40;

  page.drawText("Submitted form details", {
    x: 36,
    y: startY,
    size: 12,
    font,
    color,
  });
  visibleLines.forEach((line, index) => {
    page.drawText(line.slice(0, 110), {
      x: 36,
      y: startY - ((index + 1) * lineHeight),
      size: 9,
      font,
      color: rgb(0.1, 0.15, 0.2),
    });
  });

  return pdf.save();
}

function normalizePdfFieldName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function flattenPdfValues(fields, values, result = []) {
  fields.forEach((field) => {
    if (field.type === "notice") return;
    if (field.type === "repeater") {
      (values[field.id] || []).forEach((row, index) => {
        flattenPdfValues(
          field.fields.map((child) => ({
            ...child,
            id: `${field.id}_${index + 1}_${child.id}`,
            label: `${field.label || field.id} ${index + 1} ${child.label || child.id}`,
          })),
          row,
          result
        );
      });
      return;
    }
    const value = field.type === "checkbox"
      ? values[field.id]
      : field.type === "chips-multi"
        ? (values[field.id] || []).join(", ")
        : values[field.id];
    result.push({ field, value });
  });
  return result;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FormRenderer({ schema, onSubmitted }) {
  const initial = {};
  schema.fields.forEach((f) => {
    if (f.type === "repeater") initial[f.id] = [emptyRepeaterRow(f.fields)];
    else if (f.type === "chips-multi") initial[f.id] = [];
    else initial[f.id] = f.defaultValue || (f.type === "checkbox" ? false : "");
  });

  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [template, setTemplate] = useState(null);
  const needsAttachment = hasFileField(schema.fields);

  useEffect(() => {
    let cancelled = false;
    appStorage.get(`form-template:${schema.id}`, true).then((res) => {
      if (!cancelled && res && res.value) {
        try {
          setTemplate(JSON.parse(res.value));
        } catch (error) {
          console.error("Could not load form template", error);
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [schema.id]);

  const setField = (id) => (v) => setValues((cur) => ({ ...cur, [id]: v }));

  const canSubmit = allRequiredFilled(schema.fields, values);

  const handleSubmit = async () => {
    setSubmitting(true);
    setPdfError("");

    if (schema.id === "mealwaiver" || template) {
      try {
        const bytes = template
          ? await generateUploadedTemplatePdf(template, schema, values)
          : await generateMealWaiverPdf(values);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${slugify(schema.label)}-${slugify(values.name || values.staffName || "submission")}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setSentMsg(`Your ${schema.label} PDF has been downloaded.`);
        onSubmitted && onSubmitted();
      } catch (error) {
        console.error("Could not generate Meal Break Waiver PDF", error);
        setPdfError(error instanceof Error ? error.message : "Could not generate the PDF. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const nameGuess =
      values.name || values.staffName || (values.entries && values.entries[0] && values.entries[0].date) || "";
    const body = buildEmailBody(schema.fields, values);
    const mailto = `mailto:Admin@blueheartsabaservices.com?subject=${encodeURIComponent(
      `${schema.label} - ${nameGuess}`
    )}&body=${encodeURIComponent(body)}`;

    try {
      await appStorage.set(
        `submission:${schema.id}:${Date.now()}`,
        JSON.stringify({ ...values, submittedAt: new Date().toISOString() }),
        false
      );
    } catch (err) {
      console.error("Could not save submission history", err);
    }

    window.location.href = mailto;
    setSentMsg(
      needsAttachment
        ? "Your email app should be opening with this form filled in — attach the photo(s) yourself before hitting send, since email links can't attach files automatically."
        : "Your email app should be opening with this form filled in — review and hit send."
    );
    setSubmitting(false);
    onSubmitted && onSubmitted();
  };

  return (
    <div className="space-y-6">
      {schema.fields
        .filter((f) => isVisible(f, values))
        .map((f) => (
          <React.Fragment key={f.id}>
            <FieldBlock field={f} value={values[f.id]} onChange={setField(f.id)} />
          </React.Fragment>
        ))}

      <button
        type="button"
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: COLORS.heartDeep }}
      >
        <Send size={16} />
        {schema.id === "mealwaiver" || template ? "Generate PDF" : "Sign & Send to Admin"}
      </button>

      {(sentMsg || pdfError) && (
        <div className="flex items-start gap-2 text-[13.5px] rounded-md p-3" style={{ background: "#EAF3EC", color: COLORS.good }}>
          <Mail size={16} className="mt-0.5 flex-shrink-0" />
          <span>{pdfError || sentMsg}</span>
        </div>
      )}
    </div>
  );
}

function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: COLORS.sand }}>
        <Clock size={22} color={COLORS.heartDeep} />
      </div>
      <p className="text-[15px] font-medium" style={{ color: COLORS.ink }}>
        {label} is coming soon
      </p>
    </div>
  );
}

// ---------- admin: field editor ----------
function OptionsEditor({ options, onChange }) {
  const text = (options || []).join(", ");
  return (
    <Field label="Options (comma-separated)">
      <TextInput
        defaultValue={text}
        onBlur={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
        placeholder="Option A, Option B, Option C"
      />
    </Field>
  );
}

function AdminFieldEditor({ field, onChange, onRemove, onMove, first, last, depth }) {
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...field, ...patch });

  return (
    <div
      className="rounded-lg p-3"
      style={{ border: `1px solid ${COLORS.line}`, background: depth ? COLORS.paper : "white" }}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 flex items-center gap-2 text-left">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
            style={{ background: COLORS.sand, color: COLORS.heartDeep }}
          >
            {FIELD_TYPE_LABELS[field.type] || field.type}
          </span>
          <span className="text-[14px] font-medium truncate" style={{ color: COLORS.ink }}>
            {field.label || "(untitled field)"}
          </span>
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={first} style={{ color: first ? "#D8D2C4" : COLORS.heartDeep }}>
          <ArrowUp size={14} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={last} style={{ color: last ? "#D8D2C4" : COLORS.heartDeep }}>
          <ArrowDown size={14} />
        </button>
        <button type="button" onClick={onRemove} style={{ color: COLORS.bad }}>
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 pl-1">
          {field.type !== "checkbox" && (
            <Field label="Label / question text">
              <TextInput value={field.label} onChange={(e) => set({ label: e.target.value })} />
            </Field>
          )}
          {field.type === "checkbox" && (
            <Field label="Agreement text shown next to the checkbox">
              <TextArea value={field.label} onChange={(e) => set({ label: e.target.value })} rows={2} />
            </Field>
          )}
          {field.type !== "notice" && field.type !== "repeater" && (
            <Field label="PDF field name (optional)" hint="Use the internal field name from the uploaded fillable PDF when it differs from this field's id or label.">
              <TextInput value={field.pdfFieldName || ""} onChange={(e) => set({ pdfFieldName: e.target.value })} placeholder="e.g. employee_name" />
            </Field>
          )}
          {field.type !== "notice" && field.type !== "repeater" && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Field label="PDF page">
                <TextInput type="number" min="1" value={field.pdfPlacement?.page || ""} onChange={(e) => set({ pdfPlacement: { ...field.pdfPlacement, page: e.target.value } })} placeholder="1" />
              </Field>
              <Field label="X">
                <TextInput type="number" min="0" value={field.pdfPlacement?.x || ""} onChange={(e) => set({ pdfPlacement: { ...field.pdfPlacement, x: e.target.value } })} placeholder="72" />
              </Field>
              <Field label="Y">
                <TextInput type="number" min="0" value={field.pdfPlacement?.y || ""} onChange={(e) => set({ pdfPlacement: { ...field.pdfPlacement, y: e.target.value } })} placeholder="700" />
              </Field>
              <Field label="Width">
                <TextInput type="number" min="1" value={field.pdfPlacement?.width || ""} onChange={(e) => set({ pdfPlacement: { ...field.pdfPlacement, width: e.target.value } })} placeholder="180" />
              </Field>
              <Field label="Font size">
                <TextInput type="number" min="1" value={field.pdfPlacement?.fontSize || ""} onChange={(e) => set({ pdfPlacement: { ...field.pdfPlacement, fontSize: e.target.value } })} placeholder="11" />
              </Field>
            </div>
          )}
          {field.type !== "notice" && field.type !== "repeater" && (
            <p className="text-[11.5px]" style={{ color: "#8A8378" }}>
              For a flattened PDF, enter placement values above. Coordinates use PDF points from the bottom-left; leave PDF page blank unless this field should be drawn on the template.
            </p>
          )}
          {["text", "email", "tel", "number", "textarea", "signature", "file"].includes(field.type) && (
            <Field label="Placeholder (optional)">
              <TextInput value={field.placeholder || ""} onChange={(e) => set({ placeholder: e.target.value })} />
            </Field>
          )}
          {(field.type === "chips" || field.type === "chips-multi") && (
            <OptionsEditor options={field.options} onChange={(options) => set({ options })} />
          )}
          {field.type !== "notice" && field.type !== "repeater" && (
            <Toggle checked={!!field.required} onChange={(v) => set({ required: v })} label="Required" />
          )}
          {field.type === "notice" && (
            <Field label="Text (one point per line)" hint="Rendered as a numbered list if the form calls for one.">
              <TextArea
                defaultValue={(field.content || []).join("\n")}
                onBlur={(e) =>
                  set({ content: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                }
                rows={4}
              />
            </Field>
          )}
          {field.type === "repeater" && !depth && (
            <div className="space-y-2 pt-1">
              <div
                className="text-[11px] tracking-wide uppercase font-medium"
                style={{ color: COLORS.heartDeep, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Fields inside each {field.label || "entry"}
              </div>
              <AdminFieldList
                fields={field.fields}
                onChange={(fields) => set({ fields })}
                depth={(depth || 0) + 1}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminFieldList({ fields, onChange, depth }) {
  const [addingType, setAddingType] = useState("text");

  const updateAt = (i, next) => onChange(fields.map((f, idx) => (idx === i ? next : f)));
  const removeAt = (i) => onChange(fields.filter((_, idx) => idx !== i));
  const moveAt = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const addField = () => {
    const base = { id: `f_${uid()}`, type: addingType, label: "New field", required: false };
    if (addingType === "chips" || addingType === "chips-multi") base.options = ["Option A", "Option B"];
    if (addingType === "notice") base.content = ["New info text"];
    if (addingType === "repeater")
      base.fields = [{ id: `f_${uid()}`, type: "text", label: "Field", required: false }];
    onChange([...fields, base]);
  };

  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <AdminFieldEditor
          key={f.id}
          field={f}
          depth={depth}
          first={i === 0}
          last={i === fields.length - 1}
          onChange={(next) => updateAt(i, next)}
          onRemove={() => removeAt(i)}
          onMove={(dir) => moveAt(i, dir)}
        />
      ))}
      <div className="flex items-center gap-2 pt-1">
        <select
          value={addingType}
          onChange={(e) => setAddingType(e.target.value)}
          className="rounded-md border px-2 py-1.5 text-[13px]"
          style={{ borderColor: COLORS.line }}
        >
          {(!depth ? Object.keys(FIELD_TYPE_LABELS) : Object.keys(FIELD_TYPE_LABELS).filter((t) => t !== "repeater")).map((t) => (
            <option key={t} value={t}>
              {FIELD_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full border"
          style={{ borderColor: COLORS.line, color: COLORS.heartDeep }}
        >
          <Plus size={14} />
          Add field
        </button>
      </div>
    </div>
  );
}

function AdminFormCard({ schema, onChange, onRemove, onMove, first, last }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[schema.icon] || FileText;
  const set = (patch) => onChange({ ...schema, ...patch });

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.line}`, background: "white" }}>
      <div className="flex items-center gap-3 p-4">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: COLORS.sand }}>
          <Icon size={16} color={COLORS.heartDeep} />
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex-1 text-left">
          <div className="text-[15px] font-semibold" style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink }}>
            {schema.label || "(untitled form)"}
          </div>
          <div className="text-[12px]" style={{ color: schema.ready ? COLORS.good : "#B5AE9F" }}>
            {schema.ready ? "Visible to staff" : "Hidden (coming soon)"} · {schema.fields.length} field
            {schema.fields.length !== 1 ? "s" : ""}
          </div>
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={first} style={{ color: first ? "#D8D2C4" : COLORS.heartDeep }}>
          <ArrowUp size={16} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={last} style={{ color: last ? "#D8D2C4" : COLORS.heartDeep }}>
          <ArrowDown size={16} />
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ color: COLORS.heartDeep }}>
          <Pencil size={16} />
        </button>
      </div>

      {open && (
        <div className="p-4 pt-0 space-y-4" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            <Field label="Tab name shown to staff">
              <TextInput value={schema.label} onChange={(e) => set({ label: e.target.value })} />
            </Field>
            <Field label="Badge (optional, e.g. PTO)">
              <TextInput value={schema.badge || ""} onChange={(e) => set({ badge: e.target.value })} />
            </Field>
            <Field label="Icon">
              <select
                value={schema.icon}
                onChange={(e) => set({ icon: e.target.value })}
                className="rounded-md border px-3 py-2 text-[14px]"
                style={{ borderColor: COLORS.line }}
              >
                {ICON_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end pb-2">
              <Toggle checked={schema.ready} onChange={(v) => set({ ready: v })} label="Visible to staff" />
            </div>
          </div>

          <div>
            <div
              className="text-[11px] tracking-wide uppercase font-medium mb-2"
              style={{ color: COLORS.heartDeep, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Fields on this form
            </div>
            <AdminFieldList fields={schema.fields} onChange={(fields) => set({ fields })} depth={0} />
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full border"
            style={{ borderColor: COLORS.bad, color: COLORS.bad }}
          >
            <Trash2 size={14} />
            Delete this form
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateManager({ schemas }) {
  const [templates, setTemplates] = useState({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all(schemas.map(async (schema) => {
      try {
        const res = await appStorage.get(`form-template:${schema.id}`, true);
        return [schema.id, res && res.value ? JSON.parse(res.value) : null];
      } catch {
        return [schema.id, null];
      }
    })).then((entries) => {
      if (!cancelled) setTemplates(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [schemas]);

  const upload = async (schema, event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setStatus("Please choose a PDF file.");
      return;
    }
    try {
      const next = { name: file.name, dataUrl: await readFileAsDataUrl(file) };
      const saved = await appStorage.set(`form-template:${schema.id}`, JSON.stringify(next), true);
      if (!saved) throw new Error("Storage rejected the template");
      setTemplates((current) => ({ ...current, [schema.id]: next }));
      setStatus(`${schema.label} template uploaded.`);
    } catch (error) {
      console.error("Could not save form template", error);
      setStatus("Could not save that template. Try a smaller PDF.");
    }
  };

  const remove = async (schema) => {
    try {
      await appStorage.set(`form-template:${schema.id}`, "", true);
      setTemplates((current) => ({ ...current, [schema.id]: null }));
      setStatus(`${schema.label} template removed.`);
    } catch {
      setStatus("Could not remove that template.");
    }
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ border: `1px solid ${COLORS.line}`, background: COLORS.paper }}>
      <div>
        <h3 className="text-[16px] font-semibold" style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink }}>
          PDF templates
        </h3>
        <p className="text-[12.5px]" style={{ color: "#8A8378" }}>
          Upload the PDF used by each tab. Uploads save automatically; the Save changes button below is for form fields and tab settings.
        </p>
      </div>
      <div className="space-y-2">
        {schemas.map((schema) => (
          <div key={schema.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md p-3" style={{ background: "white", border: `1px solid ${COLORS.line}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium" style={{ color: COLORS.ink }}>{schema.label}</div>
              <div className="text-[12px] truncate" style={{ color: templates[schema.id] ? COLORS.good : "#8A8378" }}>
                {templates[schema.id] ? templates[schema.id].name : "No PDF uploaded"}
              </div>
            </div>
            <label className="inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-md border cursor-pointer" style={{ borderColor: COLORS.heartDeep, color: COLORS.heartDeep }}>
              <Upload size={14} />
              {templates[schema.id] ? "Replace" : "Upload PDF"}
              <input type="file" accept="application/pdf" onChange={(event) => upload(schema, event)} className="hidden" />
            </label>
            {templates[schema.id] && (
              <button type="button" onClick={() => remove(schema)} className="text-[12.5px] font-medium" style={{ color: COLORS.bad }}>
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {status && <div className="text-[12.5px]" style={{ color: COLORS.good }}>{status}</div>}
    </div>
  );
}

function AdminPanel({ schemas, setSchemas, persist, onLock }) {
  const [draft, setDraft] = useState(schemas);
  const [status, setStatus] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => setDraft(schemas), [schemas]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(schemas);

  const updateAt = (i, next) => setDraft((d) => d.map((s, idx) => (idx === i ? next : s)));
  const removeAt = (i) => {
    if (!window.confirm(`Delete "${draft[i].label}"? This can't be undone.`)) return;
    setDraft((d) => d.filter((_, idx) => idx !== i));
  };
  const moveAt = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    setDraft((d) => {
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const addForm = () => {
    if (!newLabel.trim()) return;
    const id = `${slugify(newLabel)}-${uid()}`;
    setDraft((d) => [
      ...d,
      { id, label: newLabel.trim(), icon: "FileText", ready: false, fields: [] },
    ]);
    setNewLabel("");
  };

  const handleSave = async () => {
    const ok = await persist(draft);
    if (ok) setSchemas(draft);
    setStatus(ok ? "Saved — staff will see these changes." : "Couldn't save right now, please try again.");
    setTimeout(() => setStatus(""), 4000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} color={COLORS.heartDeep} />
          <h2 className="text-[20px]" style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}>
            Manage Forms
          </h2>
        </div>
        <button type="button" onClick={onLock} className="text-[13px] font-medium" style={{ color: COLORS.heartDeep }}>
          Back to forms
        </button>
      </div>

      <div className="space-y-3">
        {draft.map((s, i) => (
          <AdminFormCard
            key={s.id}
            schema={s}
            first={i === 0}
            last={i === draft.length - 1}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
            onMove={(dir) => moveAt(i, dir)}
          />
        ))}
      </div>

      <TemplateManager schemas={draft} />

      <div className="rounded-xl p-4 flex flex-col sm:flex-row gap-2 sm:items-end" style={{ border: `1px dashed ${COLORS.line}` }}>
        <Field label="New form name" span>
          <TextInput value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Incident Report" />
        </Field>
        <button
          type="button"
          onClick={addForm}
          className="inline-flex items-center justify-center gap-1.5 text-[13.5px] font-medium px-4 py-2.5 rounded-md border"
          style={{ borderColor: COLORS.heartDeep, color: COLORS.heartDeep }}
        >
          <Plus size={15} />
          Add form
        </button>
      </div>

      <div className="flex items-center gap-3 sticky bottom-3">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md font-medium text-white transition"
          style={{ background: COLORS.heartDeep }}
        >
          <Save size={15} />
          Save changes
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => setDraft(schemas)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-medium disabled:opacity-40"
          style={{ color: COLORS.heartDeep }}
        >
          <RotateCcw size={15} />
          Discard
        </button>
        {status && (
          <span className="text-[13px]" style={{ color: COLORS.good }}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- main app ----------
function BlueHeartsFormsApp({ onSignOut, userRole }) {
  const [schemas, setSchemas] = useState(DEFAULT_SCHEMAS);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("timeoff");
  const [view, setView] = useState("form"); // 'form' | 'admin'
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await appStorage.get("form-schemas", true);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (Array.isArray(parsed) && parsed.length) setSchemas(mergeSchemas(parsed));
        } else {
          await appStorage.set("form-schemas", JSON.stringify(DEFAULT_SCHEMAS), true);
        }
      } catch (err) {
        try {
          await appStorage.set("form-schemas", JSON.stringify(DEFAULT_SCHEMAS), true);
        } catch (err2) {
          console.error("Could not seed form schemas", err2);
        }
      }
      setLoaded(true);
    })();
  }, []);

  const refreshHistory = async () => {
    try {
      const res = await appStorage.list("submission:");
      if (res && res.keys) setHistory(res.keys);
    } catch (err) {
      // no submissions yet
    }
  };
  useEffect(() => {
    refreshHistory();
  }, []);

  const persistSchemas = async (next) => {
    try {
      const res = await appStorage.set("form-schemas", JSON.stringify(next), true);
      return !!res;
    } catch (err) {
      console.error("Could not save form schemas", err);
      return false;
    }
  };

  const readyTabs = schemas.filter((s) => s.ready);
  const tab = schemas.find((t) => t.id === activeTab) || readyTabs[0];

  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.paper, fontFamily: "'Source Sans 3', sans-serif" }}>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Source+Sans+3:wght@400;500;600&family=IBM+Plex+Mono:wght@500&family=Caveat:wght@600&display=swap"
      />

      <header
        className="border-b sticky top-0 z-10 backdrop-blur"
        style={{ borderColor: COLORS.line, background: `${COLORS.paper}E6` }}
      >
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: COLORS.heartDeep }}>
            <Heart size={18} color="white" fill="white" />
          </div>
          <div className="flex-1">
            <h1 className="text-[19px] leading-tight" style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}>
              Friendly Forms
            </h1>
            <p className="text-[12px]" style={{ color: "#8A8378" }}>
              Sign and send your forms in a few taps
            </p>
          </div>
          {userRole === "admin" && (
            <button
              type="button"
              onClick={() => setView(view === "admin" ? "form" : "admin")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] font-medium flex-shrink-0"
              style={{ background: view === "admin" ? COLORS.heartDeep : COLORS.sand, color: view === "admin" ? "white" : COLORS.heartDeep }}
              title="Manage forms and PDF templates"
            >
              <ShieldCheck size={14} />
              Manage forms
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: COLORS.sand, color: COLORS.heartDeep }}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {!loaded ? (
          <p className="text-center text-[13.5px]" style={{ color: "#8A8378" }}>
            Loading forms…
          </p>
        ) : view === "admin" && userRole === "admin" ? (
          <>
            <AdminPanel
              schemas={schemas}
              setSchemas={setSchemas}
              persist={persistSchemas}
              onLock={() => setView("form")}
            />
          </>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1">
              {readyTabs.map((t) => {
                const Icon = ICONS[t.icon] || FileText;
                const active = t.id === activeTab;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13.5px] font-medium border whitespace-nowrap transition"
                    style={{
                      borderColor: active ? COLORS.heartDeep : COLORS.line,
                      background: active ? COLORS.heartDeep : "white",
                      color: active ? "white" : COLORS.ink,
                    }}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab ? (
              <div className="rounded-xl p-5 sm:p-7" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[22px]" style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink, fontWeight: 600 }}>
                    {tab.label} {tab.id !== "mealwaiver" && tab.id !== "meal" && tab.id !== "cotreatment" ? "Request" : ""}
                  </h2>
                  {tab.badge && (
                    <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: COLORS.sand, color: COLORS.heartDeep }}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                {tab.ready ? (
                  <FormRenderer schema={tab} onSubmitted={refreshHistory} />
                ) : (
                  <ComingSoon label={tab.label} />
                )}
              </div>
            ) : (
              <p className="text-center text-[13.5px]" style={{ color: "#8A8378" }}>
                No forms are available yet.
              </p>
            )}

            {history.length > 0 && (
              <p className="text-[12.5px] text-center mt-5" style={{ color: "#8A8378" }}>
                {history.length} form{history.length !== 1 ? "s" : ""} submitted from this device
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onSubmit, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event) => {
    event.preventDefault();
    onSubmit(email, password);
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand-mark"><Heart size={25} color="white" fill="white" /></div>
        <p className="auth-eyebrow">Welcome back</p>
        <h1 id="login-title">Friendly Forms</h1>
        <p className="auth-copy">Sign in to access your team forms and requests.</p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ConfigurationScreen() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="config-title">
        <div className="auth-brand-mark"><Heart size={25} color="white" fill="white" /></div>
        <p className="auth-eyebrow">Almost ready</p>
        <h1 id="config-title">Connect Friendly Forms</h1>
        <p className="auth-copy">{supabaseConfigError}</p>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted) {
        setSession(currentSession);
        setAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      setLoginError("");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(error.message);
      } else if (data.session) {
        setSession(data.session);
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (supabaseConfigError) return <ConfigurationScreen />;
  if (authLoading) return <main className="auth-page"><p className="auth-loading">Loading Friendly Forms...</p></main>;
  if (!session) return <LoginScreen onSubmit={signIn} loading={loginLoading} error={loginError} />;
  const userRole = session.user.app_metadata?.role === "admin" || session.user.user_metadata?.role === "admin"
    ? "admin"
    : "employee";
  return <BlueHeartsFormsApp onSignOut={signOut} userRole={userRole} />;
}