import {syntheticFixture} from '../src/synthetic-fixtures.mjs';
import {inspect,parseClients,parseMonthly,hash} from '../src/domain.mjs';
import {preparedExample} from '../src/sample.mjs';
import {rulesHash} from '../src/rules.mjs';

export const fixture=name=>structuredClone(syntheticFixture(name));

export function savedReviewBatch(){
  const source=fixture('paul'),baseDoc=inspect(source),baseRow=parseMonthly(fixture('monthly'))[0],baseClient=parseClients(fixture('clients'))[0];
  const keys=['Roman','Ryan','Adam'];
  return {id:'synthetic-saved-reviews',capturedAt:'2026-09-17T00:00:00.000Z',rulesHash,reviews:keys.map((key,index)=>{
    const doc=structuredClone(baseDoc);doc.documentId=`synthetic-saved-document-${index+1}`;doc.sourceHash=hash(doc.paragraphs);
    const client={...baseClient,key,name:`${key} Example Law`};
    const hasFolder=index===0,row={...baseRow,clientKey:key,documentId:doc.documentId,documentUrl:`https://docs.google.com/document/d/${doc.documentId}/edit`,folderId:hasFolder?'synthetic-visual-folder':null,folderUrl:hasFolder?'https://drive.google.com/drive/folders/synthetic-visual-folder':'',issues:hasFolder?[]:['A Visual folder link is required in L.']};
    return {key:key.toLowerCase(),row,client,doc,plan:preparedExample(doc)};
  })};
}
