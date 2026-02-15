const h={maxRecentTurns:10,targetTokenBudget:4e3,preserveCodeBlocks:!0,preserveToolCalls:!0};function m(e){return Math.ceil(e.length/4)}function S(e,i={}){const o={...h,...i},n=structuredClone(e),s=n.history.recentTurns;if(s.length<=o.maxRecentTurns)return n;const r=s.slice(0,s.length-o.maxRecentTurns),c=s.slice(s.length-o.maxRecentTurns),t=5,a=[];for(let l=0;l<r.length;l+=t)a.push(r.slice(l,l+t));const u=[...n.history.compressedSegments];let p=u.length;for(const l of a){const f=g(l,p,o);u.push(f),p++}return n.history.compressedSegments=u,n.history.recentTurns=c,n.meta.updatedAt=Date.now(),n}function g(e,i,o){const n=T(e,o),s=C(e),r=x(e),c=e.map(a=>a.content).join(" "),t=m(n)/m(c);return{id:`segment_${i}`,turnRange:[0,e.length-1],summary:n,keyDecisions:s,preservedInvariants:r,originalTurnCount:e.length,compressionRatio:Math.round(t*100)/100}}function T(e,i){const o=[];for(const n of e){const s=n.role==="user"?"USER":"ASSISTANT";if(n.role==="user"){const r=n.content.length>200?n.content.slice(0,200)+"...":n.content;o.push(`[${s}]: ${r}`)}if(n.role==="assistant"){if(i.preserveCodeBlocks&&n.codeBlocks.length>0)for(const t of n.codeBlocks){const a=t.code.length>500?t.code.slice(0,500)+`
// ... truncated`:t.code;o.push(`[${s} CODE${t.filename?` (${t.filename})`:""}]: \`\`\`${t.language}
${a}
\`\`\``)}if(i.preserveToolCalls&&n.toolCalls.length>0)for(const t of n.toolCalls)o.push(`[${s} TOOL]: Called ${t.name}(${JSON.stringify(t.arguments).slice(0,100)})`);const r=n.content.split(/[.!?]\s+/);r.length>0&&o.push(`[${s}]: ${r[0].slice(0,150)}...`);const c=r.filter(t=>/\b(important|note|key|critical|must|decision|constraint)\b/i.test(t));for(const t of c.slice(0,3))o.push(`[${s} KEY]: ${t.slice(0,200)}`)}}return o.join(`
`)}function C(e){const i=[],o=[/(?:decided|chose|selected|going with|opted for|will use)\s+(.+?)(?:\.|$)/gi,/(?:decision|approach|strategy):\s*(.+?)(?:\.|$)/gi,/(?:let's|we'll|i'll)\s+(.+?)(?:\.|$)/gi];for(const n of e)if(n.role==="assistant")for(const s of o){let r;for(;(r=s.exec(n.content))!==null;){const c=r[0].trim().slice(0,200);i.includes(c)||i.push(c)}}return i.slice(0,10)}function x(e){const i=[],o=[/(?:always|must always|never change|keep|maintain|preserve)\s+(.+?)(?:\.|$)/gi,/(?:requirement|constraint|invariant):\s*(.+?)(?:\.|$)/gi,/(?:do not|don't|cannot|must not)\s+(.+?)(?:\.|$)/gi];for(const n of e)for(const s of o){let r;for(;(r=s.exec(n.content))!==null;){const c=r[0].trim().slice(0,200);i.includes(c)||i.push(c)}}return i.slice(0,10)}function $(e,i=4e3){const o=[];o.push(`# Task Continuation Context (CLO v${e.schemaVersion})
**Task**: ${e.meta.title}
**Objective**: ${e.meta.objective}
**Total Turns**: ${e.meta.totalTurns} across ${e.meta.platforms.join(", ")}
**Models Used**: ${e.meta.models.join(", ")}
`);const n=e.constraints.filter(t=>t.active);if(n.length>0&&o.push(`## Active Constraints
`+n.map(t=>`- ${t.description}`).join(`
`)),e.decisions.length>0){const t=e.decisions.slice(-10);o.push(`## Key Decisions
`+t.map(a=>`- **${a.description}**: ${a.rationale}`).join(`
`))}e.artifacts.length>0&&o.push(`## Active Artifacts
`+e.artifacts.map(t=>`### ${t.name} (v${t.version}, ${t.type})
\`\`\`${t.language||""}
${t.content.slice(0,500)}
\`\`\``).join(`

`));const s=e.openQuestions.filter(t=>!t.resolved);if(s.length>0&&o.push(`## Unresolved Questions
`+s.map(t=>`- ${t.question}`).join(`
`)),e.nextAction&&o.push(`## Next Intended Action
${e.nextAction}`),e.history.compressedSegments.length>0&&o.push(`## Conversation Summary (Compressed)
`+e.history.compressedSegments.map(t=>`### Segment (${t.originalTurnCount} turns, ${t.compressionRatio}x compression)
${t.summary}`).join(`

`)),e.history.recentTurns.length>0){const t=e.history.recentTurns.slice(-5).map(a=>{const u=a.role==="user"?"USER":"ASSISTANT",p=a.content.length>300?a.content.slice(0,300)+"...":a.content;return`[${u}]: ${p}`}).join(`
`);o.push(`## Recent Conversation
${t}`)}let r=o.join(`

---

`);const c=m(r);if(c>i){const t=i/c;r=r.slice(0,Math.floor(r.length*t)),r+=`

[Context truncated to fit token budget]`}return r}const d={chatgpt:{platform:"chatgpt",supportsSystemPrompt:!1,supportsStreaming:!0,streamingProtocol:"sse",maxContextTokens:128e3,supportsToolCalls:!0,supportsCodeExecution:!0,supportsFileUpload:!0,injectionMethod:"user_message"},claude:{platform:"claude",supportsSystemPrompt:!1,supportsStreaming:!0,streamingProtocol:"sse",maxContextTokens:2e5,supportsToolCalls:!0,supportsCodeExecution:!1,supportsFileUpload:!0,injectionMethod:"user_message"},gemini:{platform:"gemini",supportsSystemPrompt:!0,supportsStreaming:!0,streamingProtocol:"sse",maxContextTokens:1e6,supportsToolCalls:!0,supportsCodeExecution:!0,supportsFileUpload:!0,injectionMethod:"user_message"},grok:{platform:"grok",supportsSystemPrompt:!1,supportsStreaming:!0,streamingProtocol:"sse",maxContextTokens:128e3,supportsToolCalls:!1,supportsCodeExecution:!1,supportsFileUpload:!1,injectionMethod:"user_message"},unknown:{platform:"unknown",supportsSystemPrompt:!1,supportsStreaming:!1,streamingProtocol:"unknown",maxContextTokens:4e3,supportsToolCalls:!1,supportsCodeExecution:!1,supportsFileUpload:!1,injectionMethod:"user_message"}};function v(e){return d[e]||d.unknown}function y(e,i){const o=v(i),n=Math.floor(o.maxContextTokens*.25),s=$(e,n),r=k(s);return{text:r,method:o.injectionMethod,tokenEstimate:Math.ceil(r.length/4)}}function k(e,i,o){return`[CONTEXT CONTINUATION — Injected by CLO (Cross-LLM Context Orchestrator)]
You are continuing a task that was previously worked on across multiple LLM sessions.
The following is a structured state snapshot. Treat it as ground truth for the task.
Do NOT re-derive or question the decisions below unless asked.
Resume from where the previous session left off.

`+e+`
---
[END OF INJECTED CONTEXT]
Please acknowledge this context and continue with the next action described above.`}function E(e,i){const o=b(i);for(const n of o){const s=document.querySelector(n);if(s){if(s instanceof HTMLTextAreaElement)return s.value=e,s.dispatchEvent(new Event("input",{bubbles:!0})),s.dispatchEvent(new Event("change",{bubbles:!0})),!0;if(s.getAttribute("contenteditable")==="true")return s.textContent=e,s.dispatchEvent(new Event("input",{bubbles:!0})),!0;const r=s.querySelector('[contenteditable="true"]');if(r)return r.textContent=e,r.dispatchEvent(new Event("input",{bubbles:!0})),!0}}return!1}function b(e){switch(e){case"chatgpt":return["#prompt-textarea",'textarea[data-id="root"]','[contenteditable="true"]',"textarea"];case"claude":return['[contenteditable="true"].ProseMirror','[contenteditable="true"]',"textarea"];case"gemini":return[".ql-editor",'[contenteditable="true"]',"textarea[aria-label]","textarea"];case"grok":return["textarea[placeholder]",'[contenteditable="true"]',"textarea"];default:return['[contenteditable="true"]',"textarea"]}}export{S as c,E as i,y as p};
