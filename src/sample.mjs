// This prepared example is a source-grounded draft, never an API result or approval.
export function preparedExample(doc){
  const quote=(id)=>({paragraphId:id,quote:doc.paragraphs.find(p=>p.id===id).text});
  const sentence=(text,...ids)=>({text,evidence:ids.map(quote)});
  const videos=[{
    candidateId:'t.0:5706',question:'How Do Support Letters Help Prove Your Case?',reason:'A distinct evidence requirement with specific guidance in the article.',
    sentences:[
      sentence('For a Michigan license appeal, support letters provide independent evidence of your sobriety.','t.0:5751','t.0:243'),
      sentence('Submit three to six signed, dated letters from people who know you well.','t.0:5751','t.0:6450'),
      sentence('Include how they know you, how often they see you, your sobriety date, and observed changes.','t.0:6180'),
      sentence('The letters must match your evaluation.','t.0:6450')
    ],cta:'',disclaimer:'',reviewFlags:[]
  },{
    candidateId:'t.0:3744',question:'What Should a Substance Use Evaluation Include?',reason:'Covers the evaluation and supporting lab report, separate from community letters.',
    sentences:[
      sentence('For a Michigan license appeal, the evaluation records your history, diagnosis, and prognosis.','t.0:4042','t.0:243'),
      sentence('A licensed evaluator completes form SOS-258, dated within 90 days of the state receiving your paperwork.','t.0:3792'),
      sentence('Submit a 12-panel urinalysis drug screen with a lab report measuring at least two integrity variables.','t.0:4302')
    ],cta:'',disclaimer:'',reviewFlags:[]
  }];
  const articleIdentity={name:'Example Defense Law',address:'123 Main Street, Suite 100 in Example City',phone:'(555) 010-2200',evidence:[{field:'name',...quote('t.0:719')},{field:'address',...quote('t.0:13083')},{field:'phone',...quote('t.0:13083')}]};
  return {articleIdentity,presenterContext:{gender:'male',lawyerBlurbParagraphIds:['t.0:6880']},videos,skipped:doc.candidates.filter(c=>!videos.some(v=>v.candidateId===c.id)).map(c=>({candidateId:c.id,reason:'Deferred from this two-script prepared example. Still eligible for later selection.'}))};
}
