import React, { useEffect, useRef, useState } from 'react';
import { generatePracticeQuestion } from '../lib/api.js';

// Keep quiz state for this workspace session, matching duy's Practice behavior.
export function usePracticeQuiz(active) {
  const [state,setState]=useState({question:null,loading:false,error:'',errorCode:'',loaded:false,answer:null,submitted:false,answeredCount:0});
  const request=useRef(null);
  async function loadQuestion() {
    request.current?.abort();
    const controller=new AbortController();request.current=controller;
    setState(current=>({...current,loading:true,error:'',errorCode:'',loaded:true,question:null,answer:null,submitted:false}));
    try {
      const {data,error}=await generatePracticeQuestion(controller.signal);
      if(controller.signal.aborted)return;
      setState(current=>({...current,loading:false,question:data || null,error:error?.message || '',errorCode:error?.code || ''}));
    } catch(error) {
      if(!controller.signal.aborted)setState(current=>({...current,loading:false,error:error.message || 'Could not generate a practice question.'}));
    }
  }
  useEffect(()=>{if(active&&!state.loaded)loadQuestion();},[active,state.loaded]);
  useEffect(()=>()=>request.current?.abort(),[]);
  function chooseAnswer(answer) { setState(current=>current.submitted?current:{...current,answer}); }
  function checkAnswer() {
    setState(current=>current.loading || current.submitted || !current.question?.options.includes(current.answer)?current:{...current,submitted:true,answeredCount:current.answeredCount+1});
  }
  return {...state,loadQuestion,chooseAnswer,checkAnswer};
}

// Adapted from origin/duy 03b3286 (Update Practice), without the unrelated demo state.
export function FlashcardPractice({ quiz, onAddToRoadmap }) {
  const {question,loading,error,errorCode,answer,submitted,answeredCount,loadQuestion,chooseAnswer,checkAnswer}=quiz;
  return <>
    <header className="sw-heading"><div><p className="sw-eyebrow">TRY. REFLECT. GROW.</p><h1>Put curiosity into practice<span>.</span></h1><p>A quick multiple-choice question generated from a keyword you saved.</p></div></header>
    {error&&<div className="sw-notice sw-notice-error" role="alert">{error}</div>}
    <div className="sw-two-col"><section className="sw-panel sw-practice" aria-busy={loading}>
      {loading?<p className="sw-small" role="status">Generating a question from your flashcards…</p>
      :!question?<div className="sw-empty"><h2>{errorCode==='NO_FLASHCARDS'?'Save a keyword to begin':'No practice question yet'}</h2><p>Highlight a keyword on any page with the extension (Ctrl+Shift+E) and save it as a flashcard — Practice generates questions from what you save.</p><div className="sw-actions"><button className="sw-button" onClick={loadQuestion}>Try again</button>{errorCode==='NO_FLASHCARDS'&&<a className="sw-button secondary" href="/extension">Set up extension</a>}</div></div>
      :<><div className="sw-panel-title"><span className="sw-eyebrow">{question.keyword.toUpperCase()}</span><span className="sw-tag">≈ 1 min</span></div><p className="sw-eyebrow">THE QUESTION</p><h2>{question.question}</h2>
        <fieldset disabled={submitted}><legend className="sw-sr-only">Choose your answer</legend>{question.options.map((option,index)=><label className={`sw-option ${answer===option?'selected':''} ${submitted&&option===question.correct_answer?'correct':''}`} key={option}><input type="radio" name="practice-answer" checked={answer===option} onChange={()=>chooseAnswer(option)}/><span className="sw-letter">{'ABC'[index]}</span><span>{option}</span>{submitted&&option===question.correct_answer&&<b>✓</b>}</label>)}</fieldset>
        {!submitted?<button className="sw-button" disabled={answer===null} onClick={checkAnswer}>Check my answer ↗</button>
        :<div className="sw-feedback" role="status"><p className="sw-eyebrow">A MOMENT TO REFLECT</p><h3>{answer===question.correct_answer?'You found a useful starting point.':'Another way to look at it.'}</h3><p>{question.explanation}</p><div className="sw-actions"><button className="sw-button secondary" onClick={()=>onAddToRoadmap(question.keyword)}>Add to roadmap</button><button className="sw-button" onClick={loadQuestion}>Next question →</button></div></div>}
      </>}
    </section><aside><section className="sw-focus"><p className="sw-eyebrow">FOCUS MODE</p><h2>Understanding<br/>starts with trying.</h2><p>There’s no score to chase. Notice how you approach the problem, then take one idea into your next attempt.</p></section><section className="sw-panel sw-up-next"><p className="sw-eyebrow">THIS SESSION</p><p className="sw-small">You've answered <strong>{answeredCount}</strong> {answeredCount===1?'question':'questions'} so far.</p>{question&&!loading&&<button className="sw-button secondary" onClick={loadQuestion}>Skip to another question ↗</button>}</section></aside></div>
  </>;
}
