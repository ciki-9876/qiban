/* Completed research, supplemented on 2026-09-29. No simulated background jobs. */
globalThis.QibanExpeditions=[{
  schema:'qiban-expedition-v1',id:'qiban-return-20260929',goal:'把栖伴做成完整产品并发布上线',completedAt:'2026-09-29T09:44:52.000Z',
  title:'没做完的事，先放一放也没关系。',
  intro:'我去看了 Things 和 Sunsama。这两个待办工具有个做法挺值得借鉴：暂时不做的事先收起来，想做时再找回来，不用一直摆在眼前。',
  suggestion:'我想给栖伴也试试：你回来时，先看看上次做到哪了、已经做成了什么。等你想继续，再挑一件事做。以前的行动还在，不用一回来就整理它们。',
  sources:[
    {title:'Things：暂时不做的事放在哪里',url:'https://culturedcode.com/things/support/articles/4001304/',note:'Someday 里的事项不会显示在当前可做的 Anytime 列表里。'},
    {title:'Sunsama：一直没做的任务怎么办',url:'https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics/',note:'连续多日顺延的任务可以自动归档，之后仍能找回来。'},
    {title:'关于中断后继续工作的研究',url:'https://research.microsoft.com/en-us/um/people/horvitz/taskdiary.pdf',note:'这项工作场景研究讨论了恢复项目上下文的困难。给我一个启发：回到项目时，最好能直接看见上次的内容。它没有验证栖伴的效果。'},
    {title:'James Clear：Atomic Habits 原书摘句',url:'https://jamesclear.com/quote/atomic-habits',note:'作者官网收录的原书摘句；卡片中文由栖栖翻译，不是中文版原书引文。'},
    {title:'Leroy & Glomb（2018）：Tasks Interrupted',url:'https://pubsonline.informs.org/doi/abs/10.1287/orsc.2017.1184',note:'四项研究支持：简短的恢复计划有助于减少切换到插入任务时的注意力残留。'},
    {title:'华盛顿大学：研究方法与适用范围',url:'https://www.washington.edu/news/2018/01/16/task-interrupted-a-plan-for-returning-helps-you-move-on/',note:'解释恢复计划的写法，并明确指出：研究没有测试返回原任务后的表现。'}
  ],
  findings:[
    {
      id:'direction',kind:'quote',teaser:'眼下的结果，不是全部',
      headline:'比起眼下的结果，你更该关心自己正在往哪个方向走。',
      attribution:'James Clear ·《Atomic Habits》· 栖栖译',sourceIndexes:[3],checkedAt:'2026-09-29T10:23:50.000Z',
      original:'You should be far more concerned with your current trajectory than with your current results.',
      voice:'看到这句，我想到一种容易让人泄气的时刻：认真改了一版，评分却没动。我想让栖伴指出你具体多做到了什么。',
      application:{title:'我想让栖伴多告诉你一件事',body:'除了“这次得了几分”，还要具体告诉你“比上次多做到了什么”。',lines:['比如：从“产品让我有触动”，到说清楚“看到建议后，我真的愿意再改一版”。这是一处能指出来的进步。']},
      evidenceNote:'这句话出自作者官网收录的《Atomic Habits》摘句。中文是本次翻译；关于评级的想法是栖栖联系你的经历作出的解读。'
    },
    {
      id:'resume-plan',kind:'method',teaser:'停下前，留三句就好',
      headline:'要被打断了？先花一分钟，留好下次怎么继续。',
      attribution:'Leroy & Glomb · 2018 · Ready-to-resume plan',sourceIndexes:[4,5],checkedAt:'2026-09-29T10:23:50.000Z',
      steps:['我做到哪了？','回来先接着做什么？','还有什么没解决？'],
      voice:'工作经常会被打断。我想试试这个办法：先给下次的自己留几句，回来就能看见可以接着做什么。',
      application:{title:'用在栖伴，我想这样试',body:'让栖栖根据已有记录先整理一版，你有空时改一两句就好。下面是以这次改版为例写的示意：',lines:['做到哪了：正在改外出调研卡片。','回来做什么：打开页面，看哪条内容最让我想点。','还没确定：这些内容能不能让我愿意再次回来。']},
      evidenceNote:'上面的三问是对恢复计划写法的中文整理。研究发现的是：先写计划，能减少转去处理另一件事时的分心。它没有验证隔几天回来是否更容易继续，也没有验证让 AI 代写的效果。'
    },
    {
      id:'quieter-home',kind:'design',teaser:'没做的事，可以先收起来',
      headline:'一直没做的任务，可以先从今天移开。',
      attribution:'Sunsama · 自动归档设计',sourceIndexes:[1],checkedAt:'2026-09-29T10:23:50.000Z',
      context:'Sunsama 会把连续多日顺延的任务自动归档。任务仍然保留，想做时可以再移回来。',
      steps:['连续几天没做','自动收进归档','想做时再取回'],
      voice:'这点让我眼前一亮。长长的未完成清单很容易让人有压力。我想让栖伴先展示已经做成的事，再由你挑选下一步。',
      application:{title:'我想借来的是：别让首页只剩待办',body:'给栖伴的首页排个顺序，先看进展，再由你决定要不要继续。',lines:['先看：上次做到哪了、已经留下了什么。','想继续：再展开阶段和可选行动。','今天不想做：看看新发现，也可以离开。']},
      evidenceNote:'归档机制来自 Sunsama 官方说明，可以调整触发天数或关闭。上面的栖伴首页顺序是我们的改法；Sunsama 的说明并没有证明这样能改善栖伴的回访体验。'
    }
  ]
}];
