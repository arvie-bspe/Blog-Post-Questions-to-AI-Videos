const paragraph=(text,startIndex,namedStyleType='NORMAL_TEXT')=>({text,startIndex,endIndex:startIndex+text.length+1,tabId:'t.0',namedStyleType,isListItem:false});
const cell=(formattedValue='',hyperlink)=>({...(formattedValue?{formattedValue,userEnteredValue:{stringValue:formattedValue}}:{}),...(hyperlink?{hyperlink}: {})});

function article(documentId='synthetic-document-001',title='Synthetic License Appeal Article'){
  return {documentId,title,revisionId:'synthetic-revision-1',tabId:null,paragraphs:[
    paragraph('Title Tag: Evidence for a State License Appeal',1),
    paragraph('Evidence for a State License Appeal',100,'HEADING_1'),
    paragraph('A license appeal requires consistent documents and testimony. Support letters and a current evaluation help explain the record.',243),
    paragraph('Example Defense Law',719),
    paragraph('What Should a Substance Use Evaluation Include?',3744,'HEADING_2'),
    paragraph('A licensed evaluator completes form SOS-258, dated within 90 days of the state receiving your paperwork.',3792),
    paragraph('For a Michigan license appeal, the evaluation records your history, diagnosis, and prognosis.',4042),
    paragraph('Submit a 12-panel urinalysis drug screen with a lab report measuring at least two integrity variables.',4302),
    paragraph('How Do Support Letters Help Prove Your Case?',5706,'HEADING_2'),
    paragraph('For a Michigan license appeal, support letters provide independent evidence of your sobriety. Submit three to six signed, dated letters from people who know you well.',5751),
    paragraph('Include how they know you, how often they see you, your sobriety date, and observed changes.',6180),
    paragraph('The letters must match your evaluation.',6450),
    paragraph('Attorney Alex Example handles state license appeal matters, and his practice focuses on these hearings.',6880),
    paragraph('Do I Need a Lawyer for an Appeal?',7000,'HEADING_2'),
    paragraph('A person may choose to speak with a lawyer about an appeal.',7050),
    paragraph('Example Defense Law, 123 Main Street, Suite 100 in Example City, (555) 010-2200',13083)
  ]};
}

function clients(){return [
  ['Client','HOMEPAGE URL','GMB LANDING PAGE','LAW FIRM NAME','ABOUT PAGE','ATTORNEY NAMES','','','GMB URL','ADDRESS','PHONE NUMBER','PLACE_ID'],
  ['','','','','','Attorney 1','Attorney 2','Attorney 3','','','',''],
  ['Paul','https://example.test/','--','Example Defense Law','https://example.test/about','Alex Example','--','--','https://example.test/maps','123 Main Street, Suite 100, Example City','(555) 010-2200','synthetic-place-id'],
  ['Second Sample','https://second.example.test/','--','Second Example Law','https://second.example.test/about','Jordan Example','--','--','https://second.example.test/maps','456 Test Avenue, Example City','(555) 010-3300','synthetic-place-id-2']
]}

function monthly(){
  const headers=['Client Name','Order','Order Placed?','Flag','Link ','Keyword','','Task ID','Task URL','Google Doc','PR Doc','Visual'].map(value=>cell(value));
  const values=[cell('Paul'),cell('New Blog Post'),cell('Yes'),cell(''),cell('https://example.test/license-appeal'),cell('license appeal evidence'),cell(''),cell(''),cell(''),cell('Article',`https://docs.google.com/document/d/synthetic-document-001/edit?tab=t.0`),cell('PR draft',`https://docs.google.com/document/d/synthetic-pr-document/edit`),cell('Visual',`https://drive.google.com/drive/folders/synthetic-visual-folder`)]
  return {properties:{sheetId:1680274981,title:'Synthetic Month',index:0,sheetType:'GRID',gridProperties:{rowCount:2,columnCount:12,frozenRowCount:1}},data:[{rowData:[{values:headers},{values}]}]};
}

export function syntheticFixture(name){
  if(name==='paul')return article();
  if(name==='roman')return article('synthetic-document-002','Second Synthetic Article');
  if(name==='clients')return clients();
  if(name==='monthly')return monthly();
  return null;
}
