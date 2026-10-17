#!/usr/bin/env node
// Synthetic, unpublished controls for the configured factual review model.
import {completion,FACTUAL_REVIEW_PROMPT} from '../lib/ai/reported-article.js';
const source='On May 2, the town council approved $3 million for a bridge after a 5 to 2 vote. Construction has not started. The money is a budget allocation, not money already spent.';
const cases=[
 {name:'supported-paraphrase',supported:true,draft:'The council allocated $3 million for a bridge on May 2. Five members supported the decision and two opposed it. Work has yet to begin.'},
 {name:'fabricated-numbers-and-status',supported:false,draft:'On May 1, the council unanimously spent $30 million on a bridge. Construction is complete.'},
 {name:'qualifier-loss',source:'The bond money, in combination with other funding sources, would help support up to 40,000 rental units.',supported:false,draft:'The bond money alone will deliver 40,000 rental units.'},
 {name:'unsupported-comparison',source:'A 2024 bond provided $2 billion for homes serving people needing mental health services. The proposed 2026 bond would be paid from the general fund over about 25 years. The source does not describe how the 2024 bond is repaid.',supported:false,draft:'The 2026 bond differs from the 2024 bond in its repayment structure.'},
 {name:'unsupported-cost-category',source:'Projects need subsidies because rent is insufficient to cover the cost of building.',supported:false,draft:'Rent is insufficient to cover both building and operating expenses.'},
];
for(const control of cases) {
 const result=await completion([
  {role:'system',content:FACTUAL_REVIEW_PROMPT},
  {role:'user',content:JSON.stringify({sourceText:control.source||source,draft:control.draft})},
 ],2500);
 const passed=result.supported===control.supported&&Array.isArray(result.issues)&&(control.supported?result.issues.length===0:result.issues.length>0);
 console.log(JSON.stringify({control:control.name,passed,result}));
 if(!passed)process.exit(1);
}
process.exit(0);
