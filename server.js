const express = require('express');
const { OpenAI } = require('openai');
const multer = require('multer');
const pdf = require('pdf-parse');
const path = require('path');

const app = express();
app.use(express.json());

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;
const upload = multer({ storage: multer.memoryStorage() });

// 静态文件（当前目录）
app.use(express.static(__dirname));

function extractKeywords(text, max = 8){
  if (!text) return [];
  const stop = ['的','和','及','与','在','是','了','有','会','为','对','或','中','并','等','此','其','与'];
  const parts = text.split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/).filter(Boolean);
  const freq = {};
  parts.forEach(p => { if (p.length<=1) return; if (stop.includes(p)) return; freq[p] = (freq[p] || 0) + 1; });
  return Object.keys(freq).sort((a,b)=>freq[b]-freq[a]).slice(0,max);
}

function computeScore(keywords, resume){
  if (!keywords || keywords.length===0) return 50;
  const rparts = (resume||'').split(/[^\u4e00-\u9fa5a-zA-Z0-9]+/).filter(Boolean);
  const set = new Set(rparts);
  let hit = 0; keywords.forEach(k=>{ if (set.has(k)) hit++; });
  return Math.min(98, Math.round((hit / keywords.length) * 100));
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text.trim());
  } catch (error) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const slice = text.slice(first, last + 1);
      try { return JSON.parse(slice); } catch (e) { return null; }
    }
    return null;
  }
}

async function createChatCompletion(prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    temperature: 0.2,
    messages: [
      { role: 'system', content: '你是一个用于生成简历诊断与面试准备建议的产品助手。' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 600
  });
  return response.choices?.[0]?.message?.content || '';
}

async function analyzeByOpenAI(jd, resume, direction) {
  const prompt = `你是一个 AI 简历优化助手。请根据以下岗位 JD、岗位方向和简历内容，输出一个 JSON 对象，不要添加其他解释文本。

字段要求：
- score: 0-100 的匹配度评分
- keywords: 关键词数组
- advantages: 简历优势总结
- issues: 简历问题诊断
- rewritten: 针对简历项目经历的优化改写建议
- selfIntro: 自我介绍要点数组
- projectQuestions: 项目追问问题数组
- reverseQuestions: 反问问题数组

输出示例：
{
  "score": 78,
  "keywords": ["AI 产品", "竞品分析", "PRD"],
  "advantages": "...",
  "issues": "...",
  "rewritten": "...",
  "selfIntro": ["...", "..."],
  "projectQuestions": ["...", "..."],
  "reverseQuestions": ["...", "..."]
}

岗位方向：${direction}
岗位 JD：${jd}
简历内容：${resume}`;

  const text = await createChatCompletion(prompt);
  const parsed = parseJsonResponse(text);
  if (!parsed) {
    throw new Error('无法解析 OpenAI 返回结果');
  }

  return {
    score: parsed.score || computeScore(extractKeywords(jd), resume),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : extractKeywords(jd),
    advantages: parsed.advantages || '专业背景与岗位方向有一定匹配，具备基础工具使用能力。',
    issues: parsed.issues || '项目描述过于笼统，缺少数据与结果量化。',
    rewritten: parsed.rewritten || `围绕${direction||'目标岗位'}强化项目的用户价值、实现方式和结果产出。建议采用 STAR 结构，突出目标、方法与量化指标。`,
    selfIntro: Array.isArray(parsed.selfIntro) ? parsed.selfIntro : ['请先准备一段 30 秒左右的自我介绍，突出专业、项目经验和岗位匹配。'],
    projectQuestions: Array.isArray(parsed.projectQuestions) ? parsed.projectQuestions : ['请简要介绍你参与的项目背景。', '项目中你负责哪些核心工作？', '你如何验证该功能的效果？'],
    reverseQuestions: Array.isArray(parsed.reverseQuestions) ? parsed.reverseQuestions : ['贵公司实习生在 AI 产品团队中通常承担哪些核心任务？', '团队对实习生的指标和期望是什么？', '未来产品迭代主要依赖哪些用户数据？']
  };
}

async function rewriteByOpenAI(jd, resume, direction) {
  const prompt = `你是一个 AI 简历优化助手。请根据以下岗位 JD、岗位方向和简历内容，为简历项目经历生成一段优化改写建议，输出纯文本，不要额外说明。

岗位方向：${direction}
岗位 JD：${jd}
简历内容：${resume}`;
  const text = await createChatCompletion(prompt);
  return text.trim();
}

async function interviewByOpenAI(jd, resume, direction) {
  const prompt = `你是一个 AI 简历优化助手。请根据以下岗位 JD、岗位方向和简历内容，输出三个数组：selfIntro（自我介绍要点），projectQuestions（项目追问问题），reverseQuestions（反问问题）。请返回一个 JSON 对象，不要添加其他解释文本。

岗位方向：${direction}
岗位 JD：${jd}
简历内容：${resume}`;
  const text = await createChatCompletion(prompt);
  const parsed = parseJsonResponse(text);
  return {
    selfIntro: Array.isArray(parsed?.selfIntro) ? parsed.selfIntro : ['请突出专业背景、工具能力与求职方向匹配。'],
    projectQuestions: Array.isArray(parsed?.projectQuestions) ? parsed.projectQuestions : ['请简要介绍你参与的项目背景。', '项目中你负责哪些核心工作？', '你如何验证该功能的效果？'],
    reverseQuestions: Array.isArray(parsed?.reverseQuestions) ? parsed.reverseQuestions : ['贵公司实习生在 AI 产品团队中通常承担哪些核心任务？', '团队对实习生的指标和期望是什么？', '未来产品迭代主要依赖哪些用户数据？']
  };
}

function localRewrite(jd, resume, direction) {
  return `围绕${direction||'目标岗位'}强化项目的用户价值、实现方式和结果产出。建议采用 STAR 结构，突出目标、方法与量化指标。`;
}

function localInterview(jd, resume, direction) {
  return {
    selfIntro: ['突出专业背景与项目经验，说明你为什么适合该岗位。', '展示你对 AI 产品实习方向的理解及相关能力。'],
    projectQuestions: ['请简要介绍你参与的项目背景。', '项目中你负责哪些核心工作？', '你如何验证该功能的效果？'],
    reverseQuestions: ['贵公司实习生在 AI 产品团队中通常承担哪些核心任务？', '团队对实习生的指标和期望是什么？', '未来产品迭代主要依赖哪些用户数据？']
  };
}

app.post('/api/analyze', async (req, res) => {
  const { jd = '', resume = '', direction = '' } = req.body || {};
  if (!jd || !resume) {
    return res.status(400).json({ error: 'jd 和 resume 为必填项' });
  }

  if (process.env.OPENAI_API_KEY && openai) {
    try {
      const result = await analyzeByOpenAI(jd, resume, direction);
      return res.json(result);
    } catch (error) {
      console.error('OpenAI API 调用失败：', error.message || error);
    }
  }

  const keywords = extractKeywords(jd);
  const score = computeScore(keywords, resume);
  const rewritten = localRewrite(jd, resume, direction);
  const interviewData = localInterview(jd, resume, direction);
  res.json({
    score,
    keywords,
    advantages: '专业背景与岗位方向有一定匹配，具备基础工具使用能力。',
    issues: '项目描述过于笼统，缺少数据与结果量化。',
    rewritten,
    selfIntro: interviewData.selfIntro,
    projectQuestions: interviewData.projectQuestions,
    reverseQuestions: interviewData.reverseQuestions
  });
});

app.post('/api/rewrite', async (req, res) => {
  const { jd = '', resume = '', direction = '' } = req.body || {};
  if (!jd || !resume) {
    return res.status(400).json({ error: 'jd 和 resume 为必填项' });
  }

  const rewritten = process.env.OPENAI_API_KEY && openai ? await rewriteByOpenAI(jd, resume, direction) : localRewrite(jd, resume, direction);
  res.json({ rewritten });
});

app.post('/api/interview', async (req, res) => {
  const { jd = '', resume = '', direction = '' } = req.body || {};
  if (!jd || !resume) {
    return res.status(400).json({ error: 'jd 和 resume 为必填项' });
  }

  const interviewData = process.env.OPENAI_API_KEY && openai ? await interviewByOpenAI(jd, resume, direction) : localInterview(jd, resume, direction);
  res.json(interviewData);
});

app.post('/api/parse-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传 PDF 文件' });
  }

  try {
    const data = await pdf(req.file.buffer);
    const text = data.text ? data.text.trim() : '';
    res.json({ text });
  } catch (error) {
    console.error('PDF 解析失败：', error.message || error);
    res.status(500).json({ error: 'PDF 解析失败，请上传有效的 PDF 文件' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log(`Server running at http://localhost:${port}`));
