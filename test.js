const http = require('http');
const fs = require('fs');

async function run() {
  try {
    console.log('测试 /api/analyze');
    const analyze = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jd: '负责 AI 产品需求分析与用户研究，要求熟悉竞品分析和数据洞察。',
        resume: '大三信息管理，参与 AI 产品设计项目，负责需求分析和竞品调研。',
        direction: 'AI 产品实习'
      })
    });
    const analyzeResult = await analyze.json();
    console.log('analyze result:', analyzeResult);

    console.log('测试 /api/interview');
    const interview = await fetch('http://localhost:3000/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jd: '负责 AI 产品需求分析与用户研究，要求熟悉竞品分析和数据洞察。',
        resume: '大三信息管理，参与 AI 产品设计项目，负责需求分析和竞品调研。',
        direction: 'AI 产品实习'
      })
    });
    const interviewResult = await interview.json();
    console.log('interview result:', interviewResult);
  } catch (error) {
    console.error('测试失败：', error);
  }
}

run();
