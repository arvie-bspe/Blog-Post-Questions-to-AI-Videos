// The application narrates the question once, before these answer sentences.
// Remove only a complete opening heading, never an overlapping answer phrase.
const words=text=>[...String(text||'').matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];
const canonical=word=>word.normalize('NFKC').replaceAll('’',"'").toLowerCase();
function headingLength(text,heading){
  const title=words(heading),answer=words(text);
  if(!title.length||answer.length<title.length||title.some((word,i)=>canonical(word[0])!==canonical(answer[i][0])))return 0;
  // Only heading punctuation/whitespace may precede the matched words.
  if(!/^[\s\p{P}]*$/u.test(text.slice(0,answer[0].index)))return 0;
  const last=answer[title.length-1],end=last.index+last[0].length,remainder=text.slice(end);
  if(!remainder.trim())return text.length;
  const separator=remainder.match(/^[\s\p{P}]*/u)[0];
  return /[.!?:;\r\n–—]/u.test(separator)?end+separator.length:0;
}
function trimHeading(text,video){
  for(const heading of [video.question,video.thumbnailTitle]){
    const length=headingLength(text,heading);if(length)return text.slice(length).trim();
  }
  return text;
}
export function normalizeScriptOpening(video){
  const result=structuredClone(video);
  if(!Array.isArray(result?.sentences))return result;
  while(result.sentences.length&&typeof result.sentences[0]?.text==='string'){
    const sentence=result.sentences[0],trimmed=trimHeading(sentence.text,result);
    if(trimmed===sentence.text)break;
    if(trimmed)sentence.text=trimmed;else result.sentences.shift();
  }
  return result;
}
export function normalizePlanOpenings(plan){
  const result=structuredClone(plan);
  if(Array.isArray(result?.videos))result.videos=result.videos.map(normalizeScriptOpening);
  return result;
}
export function repeatsScriptHeading(video){
  // Catch unchanged historical/manual drafts as well as repetitions later in an
  // answer. Validation blocks approval rather than silently changing saved text.
  return [...(video.sentences||[]).map(sentence=>sentence?.text),video.cta,video.disclaimer]
    .filter(text=>typeof text==='string').some(text=>text.split(/(?<=[.!?])\s+|[\r\n]+/u)
      .some(part=>trimHeading(part,video)!==part));
}
