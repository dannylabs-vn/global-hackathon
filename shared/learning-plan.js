export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PACES = { gentle: 30, steady: 45, intensive: 60 };

export function todayInZone(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = key => parts.find(p => p.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const fail = message => { throw new Error(message); };
function text(value, label, max = 1500, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Enter ${label} (${max} characters maximum).`);
  return value.trim();
}
function date(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) fail(`Choose a valid ${label}.`);
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) fail(`Choose a valid ${label}.`);
  return time;
}
const minutes = time => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) fail('Choose a valid availability time.');
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
};
const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

// Dates are calendar dates in the selected zone. UTC arithmetic avoids the server's
// own timezone changing weekdays; displayed times remain the user's local times.
export function prepareLearningPlan(input, now = new Date()) {
  if (!input?.career || !input?.context) fail('Choose a career and complete your learning preferences.');
  const career = {
    name: text(input.career.name, 'a career name', 120, true),
    description: text(input.career.description || '', 'a career description', 2000),
    skills: (Array.isArray(input.career.skills) ? input.career.skills : []).slice(0, 30).map(skill => ({
      name: text(typeof skill === 'string' ? skill : skill.name, 'a skill name', 120, true),
      level: text(typeof skill === 'string' ? '' : skill.level || '', 'a skill level', 50),
    })),
  };
  const c = input.context;
  const timezone = text(c.timezone, 'a timezone', 80, true);
  try { todayInZone(timezone, now); } catch { fail('Choose a valid IANA timezone, such as Asia/Bangkok.'); }
  if (!['beginner', 'some-experience', 'experienced'].includes(c.level)) fail('Choose your current experience level.');
  if (!Object.hasOwn(PACES, c.pace)) fail('Choose a learning pace.');
  if (!['projects', 'reading', 'mixed'].includes(c.learningStyle)) fail('Choose how you prefer to learn.');
  if (!Number.isInteger(c.weeks) || c.weeks < 1 || c.weeks > 4) fail('Choose a plan length from 1 to 4 weeks.');
  const start = date(c.startDate, 'start date');
  if (c.startDate < todayInZone(timezone, now)) fail('The start date must be today or later in your timezone.');
  if (start > now.getTime() + 366 * 86400000) fail('Choose a start date within the next year.');
  const target = c.targetDate ? date(c.targetDate, 'target date') : null;
  if (target !== null && target < start) fail('Your target date must be on or after your start date.');
  if (!Array.isArray(c.availability) || !c.availability.length || c.availability.length > 7) fail('Select at least one available day.');
  const seen = new Set();
  const availability = c.availability.map(a => {
    if (!Number.isInteger(a.day) || a.day < 0 || a.day > 6 || seen.has(a.day)) fail('Choose each available day only once.');
    seen.add(a.day);
    const from = minutes(a.start), to = minutes(a.end);
    if (to - from < 15) fail(`${DAYS[a.day]} needs at least 15 minutes, with its end time after its start time.`);
    return { day: a.day, start: a.start, end: a.end };
  });
  const context = { timezone, level: c.level, pace: c.pace, learningStyle: c.learningStyle, weeks: c.weeks,
    startDate: c.startDate, targetDate: c.targetDate || '', availability,
    currentSkills: text(c.currentSkills || '', 'your existing skills'),
    goal: text(c.goal, 'your learning goal', 1500, true),
    constraints: text(c.constraints || '', 'your learning constraints'),
  };
  const slots = [];
  for (let offset = 0; offset < c.weeks * 7; offset++) {
    const day = new Date(start + offset * 86400000);
    if (target !== null && day.getTime() > target) break;
    const window = availability.find(a => a.day === day.getUTCDay());
    if (!window) continue;
    const from = minutes(window.start);
    const duration = Math.min(PACES[c.pace], minutes(window.end) - from);
    const localDate = day.toISOString().slice(0, 10);
    // Don't schedule a session which has already started on the current day.
    const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const currentMinute = Number(timeParts.find(p=>p.type==='hour').value) * 60 + Number(timeParts.find(p=>p.type==='minute').value);
    if (localDate === todayInZone(timezone, now) && from <= currentMinute) continue;
    slots.push({ id: `session-${slots.length + 1}`, date: localDate, start: window.start, end: clock(from + duration), minutes: duration, week: Math.floor(offset / 7) + 1 });
  }
  if (!slots.length) fail('No available sessions fit these dates. Choose a later target date or another available day/time.');
  return { career, context, slots };
}

const outputText = (value, label, max = 3000) => text(value, label, max, true);
export function assembleLearningPlan(prepared, generated, id, now = new Date()) {
  if (!Array.isArray(generated?.sessions) || generated.sessions.length !== prepared.slots.length) fail('AI returned an incomplete schedule. Please try again.');
  const ids = new Set(generated.sessions.map(s => s.slotId));
  if (ids.size !== prepared.slots.length || prepared.slots.some(s => !ids.has(s.id))) fail('AI returned mismatched sessions. Please try again.');
  const activeWeeks = [...new Set(prepared.slots.map(s => s.week))];
  if (!Array.isArray(generated.milestones) || generated.milestones.length !== activeWeeks.length || activeWeeks.some(week => generated.milestones.filter(m=>m.week===week).length !== 1)) fail('AI returned incomplete milestones. Please try again.');
  return {
    version: 1, id, createdAt: now.toISOString(), career: prepared.career, context: prepared.context,
    summary: outputText(generated.summary, 'a plan summary'), feasibility: outputText(generated.feasibility, 'a feasibility note'),
    milestones: generated.milestones.map(m=>({ week:m.week, title:outputText(m.title, 'a milestone title', 200), outcome:outputText(m.outcome, 'a milestone outcome') })).sort((a,b)=>a.week-b.week),
    sessions: prepared.slots.map(slot => {
      const s = generated.sessions.find(s => s.slotId === slot.id), q = s.question;
      if (!q || !Array.isArray(q.options) || q.options.length !== 4 || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) fail('AI returned an invalid practice question. Please try again.');
      const options = q.options.map(o=>outputText(o, 'an answer option', 700));
      if (new Set(options.map(o=>o.toLowerCase())).size !== 4) fail('AI returned repeated answer options. Please try again.');
      return { ...slot, title:outputText(s.title, 'a session title', 200), skill:outputText(s.skill, 'a skill', 150),
        objective:outputText(s.objective, 'an objective'), activity:outputText(s.activity, 'an activity'), deliverable:outputText(s.deliverable, 'a deliverable'),
        question:{ prompt:outputText(q.prompt, 'a practice question'), options, correctIndex:q.correctIndex, explanation:outputText(q.explanation, 'an explanation') },
      };
    }),
  };
}
