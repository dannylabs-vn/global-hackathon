export function validatePracticeQuestion(value, expectedKeyword) {
  const text=(v,max)=>typeof v==='string' && !!v.trim() && v.length<=max;
  if(!value || !text(value.keyword,200) || !text(value.question,2000) || !text(value.explanation,4000))throw new Error('AI returned an incomplete practice question. Please retry.');
  if(expectedKeyword && value.keyword!==expectedKeyword)throw new Error('AI returned a question for a different keyword. Please retry.');
  if(!Array.isArray(value.options) || value.options.length!==3 || value.options.some(o=>!text(o,1000)) || new Set(value.options.map(o=>o.trim().toLowerCase())).size!==3 || !value.options.includes(value.correct_answer))throw new Error('AI returned invalid answer choices. Please retry.');
  return {success:true,keyword:value.keyword,question:value.question,options:value.options,correct_answer:value.correct_answer,explanation:value.explanation};
}
