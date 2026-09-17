export const learningStorageKey = userId => `skillmark:learning:v1:${userId}`;
export const emptyLearningState = () => ({ plan:null, progress:{}, reviews:{} });

export function readLearningState(storage, userId) {
  const raw = storage.getItem(learningStorageKey(userId));
  if (!raw) return emptyLearningState();
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid saved learning data');
  if (data.plan && (data.plan.version !== 1 || !data.plan.id || !Array.isArray(data.plan.sessions) || !data.plan.context || !data.plan.career || !Array.isArray(data.plan.milestones))) throw new Error('Invalid saved learning plan');
  if (data.plan && (!data.plan.sessions.length || data.plan.sessions.some(s=>!s?.id || !s.question || !Array.isArray(s.question.options) || s.question.options.length!==4))) throw new Error('Invalid saved practice sessions');
  return { plan:data.plan || null, progress:data.progress || {}, reviews:data.reviews || {} };
}

export function writeLearningState(storage, userId, state) {
  storage.setItem(learningStorageKey(userId), JSON.stringify(state));
}
