import { defineConfig, loadEnv } from 'vite';
import { createLearningPlanHandler } from './server/learning-plan-handler.js';
import { createPracticeQuestionHandler } from './server/practice-question-handler.js';

export default defineConfig(({mode}) => ({
  plugins:[{
    name:'local-learning-api',
    configureServer(server) {
      const env={...process.env,...loadEnv(mode,process.cwd(),'')};
      const routes=[['/api/learning-plan',createLearningPlanHandler({env})],['/api/practice-question',createPracticeQuestionHandler({env})]];
      for(const [path,handler] of routes)server.middlewares.use(path,async (req,res) => {
        res.status = code => {res.statusCode=code;return res;};
        res.json = data => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
        try {
          const chunks=[];let size=0;
          for await (const chunk of req) { size+=chunk.length; if(size>24000){res.status(413).json({error:'Your learning preferences are too long.'});return;}chunks.push(chunk); }
          req.body = Buffer.concat(chunks).toString();
          await handler(req,res);
        } catch { if(!res.writableEnded)res.status(400).json({error:'Could not read this request.'}); }
      });
    },
  }],
}));
